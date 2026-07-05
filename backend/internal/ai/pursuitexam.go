package ai

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	pursuitRoundDuration = 4 * time.Minute
	pursuitCatchMeters   = 85.0
)

// LatLng is a geographic coordinate.
type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// PursuitVehicle is a simulated unit on the Olathe road grid.
type PursuitVehicle struct {
	ID             string   `json:"id"`
	Role           string   `json:"role"` // police | perp
	Lat            float64  `json:"lat"`
	Lng            float64  `json:"lng"`
	Heading        float64  `json:"heading"`
	Route          []LatLng `json:"route"`
	RouteIndex     int      `json:"routeIndex"`
	RouteProgress  float64  `json:"routeProgress"`
	MaxSpeedMph    float64  `json:"maxSpeedMph"`
	OfficerName    string   `json:"officerName,omitempty"`
	OfficerRank    string   `json:"officerRank,omitempty"`
	Evaluation     string   `json:"evaluation,omitempty"`
	VehicleModel   string   `json:"vehicleModel,omitempty"`
	PursuingPerpID string   `json:"pursuingPerpId,omitempty"`
	Status         string   `json:"status"` // patrol | pursuing | caught | idle | escaped | down
	BeingPursued   bool     `json:"beingPursued"`
	Destination    *LatLng  `json:"destination,omitempty"`
	DownAt         *time.Time `json:"downAt,omitempty"`
	DownReason     string   `json:"downReason,omitempty"`
}

// PursuitRoundResult summarizes round outcome.
type PursuitRoundResult struct {
	Outcome    string `json:"outcome"` // total_failure | partial_win | total_win
	Caught     int    `json:"caught"`
	Escaped    int    `json:"escaped"`
	TotalPerps int    `json:"totalPerps"`
	Score      int    `json:"score"`
	Message    string `json:"message"`
	Grade      string `json:"grade"`
}

// PursuitExamSession is a per-user pursuit strategy exam round.
type PursuitExamSession struct {
	ID             string              `json:"id"`
	UserID         string              `json:"userId"`
	Phase          string              `json:"phase"` // active | completed | cooldown
	Round          int                 `json:"round"`
	RoundEndsAt    time.Time           `json:"roundEndsAt"`
	CooldownEndsAt *time.Time          `json:"cooldownEndsAt,omitempty"`
	Vehicles       []PursuitVehicle    `json:"vehicles"`
	Result         *PursuitRoundResult `json:"result,omitempty"`
	ArmedPoliceID  string              `json:"armedPoliceId,omitempty"`
	LastSimAt      time.Time           `json:"-"`
	CreatedAt      time.Time           `json:"createdAt"`
	UpdatedAt      time.Time           `json:"updatedAt"`
}

// PursuitExamService manages per-user pursuit exam sessions.
type PursuitExamService struct {
	sessions map[string]*PursuitExamSession
	byUser   map[string]string
	mu       sync.RWMutex
}

func NewPursuitExamService() *PursuitExamService {
	s := &PursuitExamService{
		sessions: make(map[string]*PursuitExamSession),
		byUser:   make(map[string]string),
	}
	go s.backgroundTick()
	return s
}

func (s *PursuitExamService) backgroundTick() {
	ticker := time.NewTicker(500 * time.Millisecond)
	for range ticker.C {
		s.mu.Lock()
		for _, session := range s.sessions {
			if session.Phase == "active" {
				s.simulateLocked(session)
			} else if (session.Phase == "completed" || session.Phase == "cooldown") &&
				session.CooldownEndsAt != nil && time.Now().After(*session.CooldownEndsAt) {
				next := s.newRound(session.UserID, session.Round+1)
				next.ID = session.ID
				*session = *next
			}
		}
		s.mu.Unlock()
	}
}

func (s *PursuitExamService) GetOrStart(userID string) (*PursuitExamSession, error) {
	if userID == "" {
		return nil, fmt.Errorf("user id required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if sid, ok := s.byUser[userID]; ok {
		if session, exists := s.sessions[sid]; exists {
			s.simulateLocked(session)
			return s.copySession(session), nil
		}
		delete(s.byUser, userID)
	}

	session := s.newRound(userID, 1)
	s.sessions[session.ID] = session
	s.byUser[userID] = session.ID
	return s.copySession(session), nil
}

func (s *PursuitExamService) GetState(userID string) (*PursuitExamSession, error) {
	return s.GetOrStart(userID)
}

func (s *PursuitExamService) ArmPursuit(userID, policeID string) (*PursuitExamSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, err := s.sessionForUserLocked(userID)
	if err != nil {
		return nil, err
	}
	if session.Phase != "active" {
		return nil, fmt.Errorf("round is not active")
	}

	found := false
	for i := range session.Vehicles {
		if session.Vehicles[i].ID == policeID && session.Vehicles[i].Role == "police" {
			if session.Vehicles[i].Status == "down" || session.Vehicles[i].Status == "caught" {
				return nil, fmt.Errorf("unit unavailable")
			}
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("police unit not found")
	}

	session.ArmedPoliceID = policeID
	session.UpdatedAt = time.Now()
	s.simulateLocked(session)
	return s.copySession(session), nil
}

func (s *PursuitExamService) StartPursuit(userID, policeID, perpID string) (*PursuitExamSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, err := s.sessionForUserLocked(userID)
	if err != nil {
		return nil, err
	}
	if session.Phase != "active" {
		return nil, fmt.Errorf("round is not active")
	}

	var policeIdx, perpIdx = -1, -1
	for i := range session.Vehicles {
		v := &session.Vehicles[i]
		if v.ID == policeID && v.Role == "police" {
			policeIdx = i
		}
		if v.ID == perpID && v.Role == "perp" {
			perpIdx = i
		}
	}
	if policeIdx < 0 || perpIdx < 0 {
		return nil, fmt.Errorf("invalid unit selection")
	}

	police := &session.Vehicles[policeIdx]
	perp := &session.Vehicles[perpIdx]

	if police.Status == "down" {
		return nil, fmt.Errorf("unit is down")
	}
	if police.Status != "patrol" && police.Status != "pursuing" && police.Status != "idle" {
		return nil, fmt.Errorf("police unit busy")
	}
	if perp.Status == "caught" {
		return nil, fmt.Errorf("suspect already apprehended")
	}

	police.Status = "pursuing"
	police.PursuingPerpID = perpID
	perp.BeingPursued = true
	session.ArmedPoliceID = ""
	session.UpdatedAt = time.Now()

	s.simulateLocked(session)
	return s.copySession(session), nil
}

func (s *PursuitExamService) sessionForUserLocked(userID string) (*PursuitExamSession, error) {
	sid, ok := s.byUser[userID]
	if !ok {
		return nil, fmt.Errorf("no session for user")
	}
	session, exists := s.sessions[sid]
	if !exists {
		return nil, fmt.Errorf("session not found")
	}
	return session, nil
}

func (s *PursuitExamService) newRound(userID string, roundNum int) *PursuitExamSession {
	now := time.Now()
	perpCount := 5 + rand.Intn(5)   // 5-9
	policeCount := 4 + rand.Intn(2) // 4-5

	policeSpawns := []LatLng{}
	perpSpawns := []LatLng{}
	police := make([]PursuitVehicle, 0, policeCount)
	perps := make([]PursuitVehicle, 0, perpCount)

	for i := 0; i < policeCount; i++ {
		start := randomPoliceSpawn(policeSpawns)
		policeSpawns = append(policeSpawns, start)
		police = append(police, buildPoliceVehicle(i, start))
	}

	for i := 0; i < perpCount; i++ {
		start := randomPerpSpawn(perpSpawns, policeSpawns)
		perpSpawns = append(perpSpawns, start)
		perps = append(perps, buildPerpVehicle(i, start))
	}

	vehicles := append(police, perps...)
	schedulePoliceDowns(vehicles, now)
	now = time.Now()

	return &PursuitExamSession{
		ID:          uuid.New().String(),
		UserID:      userID,
		Phase:       "active",
		Round:       roundNum,
		RoundEndsAt: now.Add(pursuitRoundDuration),
		Vehicles:    vehicles,
		LastSimAt:   now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func (s *PursuitExamService) simulateLocked(session *PursuitExamSession) {
	now := time.Now()

	if session.Phase == "cooldown" || session.Phase == "completed" {
		if session.CooldownEndsAt != nil && now.After(*session.CooldownEndsAt) {
			next := s.newRound(session.UserID, session.Round+1)
			next.ID = session.ID
			*session = *next
		}
		return
	}

	if session.LastSimAt.IsZero() {
		session.LastSimAt = now
	}

	elapsed := now.Sub(session.LastSimAt).Seconds()
	if elapsed > 0.5 {
		elapsed = 0.5
	}
	session.LastSimAt = now

	s.applyPoliceDowns(session, now)

	perpPositions := map[string]LatLng{}
	for i := range session.Vehicles {
		v := &session.Vehicles[i]
		if v.Role == "perp" && v.Status != "caught" {
			s.advanceVehicle(v, elapsed)
			perpPositions[v.ID] = LatLng{Lat: v.Lat, Lng: v.Lng}
		}
	}

	for i := range session.Vehicles {
		v := &session.Vehicles[i]
		if v.Role != "police" || v.Status == "caught" || v.Status == "down" {
			continue
		}
		if v.Status == "idle" {
			v.Status = "patrol"
		}

		if v.Status == "pursuing" && v.PursuingPerpID != "" {
			target, ok := perpPositions[v.PursuingPerpID]
			if !ok {
				v.Status = "patrol"
				v.PursuingPerpID = ""
				s.advanceVehicle(v, elapsed*0.6)
				continue
			}

			speedMps := mphToMps(v.MaxSpeedMph) * 0.92
			if elapsed > 0 {
				moveToward(v, target.Lat, target.Lng, speedMps*elapsed)
			}

			for j := range session.Vehicles {
				perp := &session.Vehicles[j]
				if perp.ID == v.PursuingPerpID && perp.Status != "caught" {
					dist := haversineMeters(v.Lat, v.Lng, perp.Lat, perp.Lng)
					if dist <= pursuitCatchMeters {
						perp.Status = "caught"
						perp.BeingPursued = false
						v.Status = "idle"
						v.PursuingPerpID = ""
					}
					break
				}
			}
		} else if v.Status == "patrol" {
			s.advanceVehicle(v, elapsed*0.55)
		}
	}

	if now.After(session.RoundEndsAt) {
		s.finishRound(session)
	}

	session.UpdatedAt = now
}

func (s *PursuitExamService) finishRound(session *PursuitExamSession) {
	caught, total := 0, 0
	for i := range session.Vehicles {
		if session.Vehicles[i].Role == "perp" {
			total++
			if session.Vehicles[i].Status == "caught" {
				caught++
			} else {
				session.Vehicles[i].Status = "escaped"
			}
		}
		if session.Vehicles[i].Role == "police" && session.Vehicles[i].Status == "pursuing" {
			session.Vehicles[i].Status = "patrol"
			session.Vehicles[i].PursuingPerpID = ""
		}
	}

	escaped := total - caught
	result := &PursuitRoundResult{
		Caught:     caught,
		Escaped:    escaped,
		TotalPerps: total,
	}

	switch {
	case caught == 0:
		result.Outcome = "total_failure"
		result.Score = 0
		result.Grade = "F"
		result.Message = "Total failure — all suspects evaded. Review unit placement and speed matching."
	case caught == total:
		result.Outcome = "total_win"
		result.Score = 100
		result.Grade = "A+"
		result.Message = "Total win — every suspect apprehended. Excellent pursuit strategy."
	default:
		result.Outcome = "partial_win"
		result.Score = int(math.Round(float64(caught) / float64(total) * 100))
		if result.Score >= 75 {
			result.Grade = "B"
		} else if result.Score >= 50 {
			result.Grade = "C"
		} else {
			result.Grade = "D"
		}
		result.Message = fmt.Sprintf("Partial win — %d of %d suspects caught. Assign faster units to remaining targets.", caught, total)
	}

	session.Result = result
	session.Phase = "completed"

	cooldown := time.Now().Add(20 * time.Second)
	session.CooldownEndsAt = &cooldown
}

func (s *PursuitExamService) advanceVehicle(v *PursuitVehicle, elapsedSec float64) {
	if len(v.Route) < 2 || elapsedSec <= 0 {
		return
	}

	speed := mphToMps(v.MaxSpeedMph)
	if v.Role == "perp" && v.BeingPursued {
		speed *= 1.15
	}
	if v.Role == "police" && v.Status == "patrol" {
		speed *= 0.55
	}

	remaining := speed * elapsedSec
	for remaining > 0 && len(v.Route) >= 2 {
		cur := v.Route[v.RouteIndex]
		nextIdx := v.RouteIndex + 1
		if nextIdx >= len(v.Route) {
			if v.Role == "perp" {
				s.maybeAssignPerpDestination(v)
				break
			}
			dest := randomGridPoint(38.86, 38.91, -94.85, -94.78)
			v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, dest)
			v.RouteIndex = 0
			v.RouteProgress = 0
			break
		}
		next := v.Route[nextIdx]

		segLen := haversineMeters(cur.Lat, cur.Lng, next.Lat, next.Lng)
		if segLen < 1 {
			v.RouteIndex = nextIdx
			if v.RouteIndex >= len(v.Route)-1 {
				if v.Role == "police" {
					dest := randomGridPoint(38.86, 38.91, -94.85, -94.78)
					v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, dest)
					v.RouteIndex = 0
				} else {
					v.RouteIndex = 0
				}
			}
			v.RouteProgress = 0
			continue
		}

		distLeft := segLen * (1 - v.RouteProgress)
		if remaining >= distLeft {
			remaining -= distLeft
			v.RouteIndex = nextIdx
			if v.RouteIndex >= len(v.Route)-1 {
				if v.Role == "police" {
					dest := randomGridPoint(38.86, 38.91, -94.85, -94.78)
					v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, dest)
					v.RouteIndex = 0
				} else {
					v.RouteIndex = 0
				}
			}
			v.RouteProgress = 0
			v.Lat = next.Lat
			v.Lng = next.Lng
			v.Heading = bearingDeg(cur.Lat, cur.Lng, next.Lat, next.Lng)
		} else {
			v.RouteProgress += remaining / segLen
			v.Lat = cur.Lat + (next.Lat-cur.Lat)*v.RouteProgress
			v.Lng = cur.Lng + (next.Lng-cur.Lng)*v.RouteProgress
			v.Heading = bearingDeg(cur.Lat, cur.Lng, next.Lat, next.Lng)
			if v.Role == "perp" {
				s.maybeAssignPerpDestination(v)
			}
			remaining = 0
		}
	}
	if v.Role == "perp" && v.Status != "caught" {
		s.maybeAssignPerpDestination(v)
	}
}

func (s *PursuitExamService) maybeAssignPerpDestination(v *PursuitVehicle) {
	if v.Destination == nil || haversineMeters(v.Lat, v.Lng, v.Destination.Lat, v.Destination.Lng) < 250 {
		dest := randomPerpDestination()
		v.Destination = &dest
		v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, dest)
		v.RouteIndex = 0
		v.RouteProgress = 0
	}
}

func (s *PursuitExamService) copySession(src *PursuitExamSession) *PursuitExamSession {
	cp := *src
	cp.Vehicles = make([]PursuitVehicle, len(src.Vehicles))
	copy(cp.Vehicles, src.Vehicles)
	if src.CooldownEndsAt != nil {
		t := *src.CooldownEndsAt
		cp.CooldownEndsAt = &t
	}
	if src.Result != nil {
		r := *src.Result
		cp.Result = &r
	}
	return &cp
}

// --- Olathe road grid simulation ---

var (
	policeProfiles = []struct {
		Rank, Eval string
	}{
		{"Patrol Officer", "Steady responder — reliable on routine intercepts"},
		{"Senior Officer", "Tactical ace — excels at high-speed coordination"},
		{"Corporal", "Veteran tracker — reads suspect patterns quickly"},
		{"Sergeant", "Command mindset — optimal unit deployment instincts"},
		{"Field Training Officer", "Precision driver — tight gap closure specialist"},
		{"Traffic Unit", "Speed specialist — fastest straight-line pursuit"},
		{"Detective", "Analytical — picks the right suspect to prioritize"},
		{"K-9 Handler", "Tenacious — never breaks off once committed"},
	}

	policeFleet = []struct {
		Model string
		Speed float64
	}{
		{"Dodge Charger Pursuit", 145},
		{"Ford Police Interceptor Utility", 131},
		{"Chevy Tahoe PPV", 124},
		{"Ford F-150 Police Responder", 118},
		{"Harley-Davidson Police Motorcycle", 112},
		{"Ram 1500 Special Service", 115},
	}

	perpFleet = []struct {
		Model string
		Speed float64
	}{
		{"Stolen Honda Civic", 108},
		{"Black Ford F-150", 115},
		{"White Chevy Tahoe", 112},
		{"Sport Motorcycle", 125},
		{"Gray Panel Van", 98},
		{"Red Toyota Corolla", 105},
		{"Blue Work Truck", 102},
		{"Green RAV4", 110},
	}

	perpAliases = []string{
		"Subject Alpha", "Subject Bravo", "Subject Charlie", "Subject Delta",
		"Subject Echo", "Subject Foxtrot", "Subject Ghost", "Subject Havoc",
	}

	policeDownReasons = []string{
		"Engine overheated — unit offline",
		"Tire blowout — awaiting backup",
		"Radio distress — mechanical failure",
		"Accident damage — out of pursuit",
	}
)

func olathePoliceZone() (latMin, latMax, lngMin, lngMax float64) {
	return 38.858, 38.905, -94.872, -94.835
}

func olathePerpZone() (latMin, latMax, lngMin, lngMax float64) {
	return 38.868, 38.912, -94.798, -94.762
}

func schedulePoliceDowns(vehicles []PursuitVehicle, roundStart time.Time) {
	policeIDs := []string{}
	for i := range vehicles {
		if vehicles[i].Role == "police" {
			policeIDs = append(policeIDs, vehicles[i].ID)
		}
	}
	if len(policeIDs) < 4 {
		return
	}
	downCount := 1 + rand.Intn(2)
	if downCount > len(policeIDs)-2 {
		downCount = len(policeIDs) - 2
	}
	if downCount < 1 {
		downCount = 1
	}
	rand.Shuffle(len(policeIDs), func(i, j int) { policeIDs[i], policeIDs[j] = policeIDs[j], policeIDs[i] })
	for i := 0; i < downCount; i++ {
		for j := range vehicles {
			if vehicles[j].ID != policeIDs[i] {
				continue
			}
			offset := 48 + rand.Intn(120)
			t := roundStart.Add(time.Duration(offset) * time.Second)
			vehicles[j].DownAt = &t
			vehicles[j].DownReason = policeDownReasons[rand.Intn(len(policeDownReasons))]
			break
		}
	}
}

func (s *PursuitExamService) applyPoliceDowns(session *PursuitExamSession, now time.Time) {
	for i := range session.Vehicles {
		v := &session.Vehicles[i]
		if v.Role != "police" || v.DownAt == nil || now.Before(*v.DownAt) || v.Status == "down" {
			continue
		}
		if v.Status == "pursuing" && v.PursuingPerpID != "" {
			for j := range session.Vehicles {
				if session.Vehicles[j].ID == v.PursuingPerpID {
					session.Vehicles[j].BeingPursued = false
					break
				}
			}
		}
		v.Status = "down"
		v.PursuingPerpID = ""
		if v.DownReason != "" {
			v.Evaluation = v.DownReason
		}
	}
}

func randomPoliceSpawn(existing []LatLng) LatLng {
	latMin, latMax, lngMin, lngMax := olathePoliceZone()
	for attempt := 0; attempt < 50; attempt++ {
		p := randomGridPoint(latMin, latMax, lngMin, lngMax)
		ok := true
		for _, e := range existing {
			if haversineMeters(p.Lat, p.Lng, e.Lat, e.Lng) < 1500 {
				ok = false
				break
			}
		}
		if ok {
			return p
		}
	}
	return randomGridPoint(latMin, latMax, lngMin, lngMax)
}

func randomPerpSpawn(existing, police []LatLng) LatLng {
	latMin, latMax, lngMin, lngMax := olathePerpZone()
	for attempt := 0; attempt < 80; attempt++ {
		p := randomGridPoint(latMin, latMax, lngMin, lngMax)
		ok := true
		for _, e := range police {
			if haversineMeters(p.Lat, p.Lng, e.Lat, e.Lng) < 5200 {
				ok = false
				break
			}
		}
		for _, e := range existing {
			if haversineMeters(p.Lat, p.Lng, e.Lat, e.Lng) < 1800 {
				ok = false
				break
			}
		}
		if ok {
			return p
		}
	}
	return randomGridPoint(latMin, latMax, lngMin, lngMax)
}

func randomPerpDestination() LatLng {
	return randomGridPoint(38.872, 38.908, -94.82, -94.785)
}

func buildPoliceVehicle(index int, start LatLng) PursuitVehicle {
	route := buildRandomPatrolRoute(start)
	profile := policeProfiles[index%len(policeProfiles)]
	fleet := policeFleet[index%len(policeFleet)]
	v := PursuitVehicle{
		ID:           fmt.Sprintf("police-%d-%s", index+1, uuid.New().String()[:6]),
		Role:         "police",
		Lat:          start.Lat,
		Lng:          start.Lng,
		Route:        route,
		RouteIndex:   0,
		RouteProgress: 0,
		Status:       "patrol",
		OfficerName:  fmt.Sprintf("Officer %s", randomOfficerName(map[string]bool{})),
		OfficerRank:  profile.Rank,
		Evaluation:   profile.Eval,
		VehicleModel: fleet.Model,
		MaxSpeedMph:  fleet.Speed + float64(rand.Intn(8)-4),
	}
	if len(route) > 1 {
		v.Heading = bearingDeg(route[0].Lat, route[0].Lng, route[1].Lat, route[1].Lng)
	}
	return v
}

func buildPerpVehicle(index int, start LatLng) PursuitVehicle {
	dest := randomPerpDestination()
	route := buildRoadRouteToDestination(start, dest)
	fleet := perpFleet[index%len(perpFleet)]
	v := PursuitVehicle{
		ID:           fmt.Sprintf("perp-%d-%s", index+1, uuid.New().String()[:6]),
		Role:         "perp",
		Lat:          start.Lat,
		Lng:          start.Lng,
		Route:        route,
		RouteIndex:   0,
		RouteProgress: 0,
		Status:       "patrol",
		OfficerName:  perpAliases[index%len(perpAliases)],
		VehicleModel: fleet.Model,
		MaxSpeedMph:  fleet.Speed + float64(rand.Intn(10)-5),
		Evaluation:   "Suspect vehicle — evasive driving toward destination",
		Destination:  &dest,
	}
	if len(route) > 1 {
		v.Heading = bearingDeg(route[0].Lat, route[0].Lng, route[1].Lat, route[1].Lng)
	}
	return v
}

func buildRandomPatrolRoute(start LatLng) []LatLng {
	dest := randomGridPoint(38.86, 38.91, -94.85, -94.78)
	return buildRoadRouteToDestination(start, dest)
}

func buildRoadRouteToDestination(start, dest LatLng) []LatLng {
	route := []LatLng{start}
	cur := start
	for safety := 0; safety < 24 && haversineMeters(cur.Lat, cur.Lng, dest.Lat, dest.Lng) > 400; safety++ {
		dLat := dest.Lat - cur.Lat
		dLng := dest.Lng - cur.Lng
		step := 0.004 + float64(rand.Intn(3))*0.002
		next := cur
		if math.Abs(dLat) >= math.Abs(dLng) {
			next.Lat += math.Copysign(step, dLat)
		} else {
			next.Lng += math.Copysign(step, dLng)
		}
		next.Lat = clamp(next.Lat, 38.855, 38.915)
		next.Lng = clamp(next.Lng, -94.865, -94.775)
		route = append(route, next)
		cur = next
	}
	route = append(route, dest)
	return route
}

func randomOfficerName(used map[string]bool) string {
	first := []string{"Martinez", "Chen", "Johnson", "Williams", "Patel", "Garcia", "Thompson", "Davis", "Wilson", "Anderson"}
	last := []string{"A", "B", "C", "D", "E", "F", "G", "H"}
	for attempt := 0; attempt < 50; attempt++ {
		name := fmt.Sprintf("%s %s", first[rand.Intn(len(first))], last[rand.Intn(len(last))])
		if !used[name] {
			used[name] = true
			return name
		}
	}
	return fmt.Sprintf("Unit %d", rand.Intn(99))
}

func randomGridPoint(latMin, latMax, lngMin, lngMax float64) LatLng {
	step := 0.004
	latSteps := int((latMax - latMin) / step)
	lngSteps := int((lngMax - lngMin) / step)
	return LatLng{
		Lat: latMin + float64(rand.Intn(latSteps+1))*step,
		Lng: lngMin + float64(rand.Intn(lngSteps+1))*step,
	}
}

func buildRoadRoute(start LatLng, length int) []LatLng {
	route := []LatLng{start}
	cur := start
	dir := rand.Intn(4)

	for i := 1; i < length; i++ {
		step := 0.004 + float64(rand.Intn(3))*0.002
		if rand.Float64() < 0.35 {
			dir = (dir + 1 + rand.Intn(3)) % 4
		}
		next := cur
		switch dir {
		case 0:
			next.Lat += step
		case 1:
			next.Lng += step
		case 2:
			next.Lat -= step
		case 3:
			next.Lng -= step
		}
		next.Lat = clamp(next.Lat, 38.855, 38.915)
		next.Lng = clamp(next.Lng, -94.865, -94.775)
		route = append(route, next)
		cur = next
	}
	return route
}

func minCrossFleetDistance(a, b []PursuitVehicle) float64 {
	minD := math.MaxFloat64
	for _, p := range a {
		for _, q := range b {
			d := haversineMeters(p.Lat, p.Lng, q.Lat, q.Lng)
			if d < minD {
				minD = d
			}
		}
	}
	return minD
}

func moveToward(v *PursuitVehicle, targetLat, targetLng float64, distMeters float64) {
	if distMeters <= 0 {
		return
	}
	bear := bearingDeg(v.Lat, v.Lng, targetLat, targetLng)
	v.Lat, v.Lng = destinationPoint(v.Lat, v.Lng, bear, distMeters)
	v.Heading = bear
}

func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func bearingDeg(lat1, lng1, lat2, lng2 float64) float64 {
	rad := math.Pi / 180
	dLng := (lng2 - lng1) * rad
	y := math.Sin(dLng) * math.Cos(lat2*rad)
	x := math.Cos(lat1*rad)*math.Sin(lat2*rad) - math.Sin(lat1*rad)*math.Cos(lat2*rad)*math.Cos(dLng)
	return math.Mod(math.Atan2(y, x)*180/math.Pi+360, 360)
}

func destinationPoint(lat, lng, bearingDeg, distMeters float64) (float64, float64) {
	const R = 6371000
	rad := math.Pi / 180
	bear := bearingDeg * rad
	lat1 := lat * rad
	lng1 := lng * rad
	lat2 := math.Asin(math.Sin(lat1)*math.Cos(distMeters/R) +
		math.Cos(lat1)*math.Sin(distMeters/R)*math.Cos(bear))
	lng2 := lng1 + math.Atan2(
		math.Sin(bear)*math.Sin(distMeters/R)*math.Cos(lat1),
		math.Cos(distMeters/R)-math.Sin(lat1)*math.Sin(lat2),
	)
	return lat2 / rad, lng2 / rad
}

func mphToMps(mph float64) float64 {
	return mph * 0.44704
}

func clamp(v, minV, maxV float64) float64 {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}
