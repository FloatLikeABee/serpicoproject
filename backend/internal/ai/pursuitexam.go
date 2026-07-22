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
	pursuitRoundDuration = 12 * time.Hour
	pursuitCooldownDuration = 5 * time.Minute
	pursuitCatchMeters   = 35.0
	simMovementScale     = 1.0
	patrolCruiseMph      = 28.0
	perpCruiseMph        = 30.0
	policePursuitBonusMph = 4.0
	perpFleeMultiplier   = 1.0
	policePursuitMultiplier = 1.0
	pursuitClosureBoost  = 1.1
	pursuitRouteRebuildM = 80.0
	fleetTotalMin        = 3
	fleetTotalMax        = 4
	minPerpPoliceSpawnM  = 600.0
	minPerpDestDistanceM = 6000.0
	minVehicleSpawnSepM  = 1200.0
	destArrivalM         = 40.0
	roadGridStep         = 0.0002
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
			if !sessionFleetUsable(session) {
				next := s.newRound(userID, session.Round)
				if session.Round < 1 {
					next.Round = 1
				}
				next.ID = session.ID
				*session = *next
			} else {
				s.simulateLocked(session)
			}
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
	if perp.Status == "caught" || perp.Status == "escaped" {
		return nil, fmt.Errorf("suspect already apprehended or evaded")
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

func randomFleetCounts() (policeCount, perpCount int) {
	total := fleetTotalMin + rand.Intn(fleetTotalMax-fleetTotalMin+1)
	// Prefer 2 police + 1–2 suspects for a clearer chase map.
	if total <= 3 {
		return 2, 1
	}
	return 2, total - 2
}

func sessionFleetUsable(session *PursuitExamSession) bool {
	police, perps := 0, 0
	for i := range session.Vehicles {
		switch session.Vehicles[i].Role {
		case "police":
			police++
		case "perp":
			perps++
		}
	}
	total := police + perps
	return total >= fleetTotalMin && total <= fleetTotalMax && police >= 1 && perps >= 1
}

func (s *PursuitExamService) newRound(userID string, roundNum int) *PursuitExamSession {
	now := time.Now()
	policeCount, perpCount := randomFleetCounts()

	perpSpawns := pickPerpSpreadSpawns(perpCount)
	perpDestinations := assignPerpDestinations(perpSpawns)
	policeSpawns := pickSpreadAnchors(policeCount, perpSpawns)

	police := make([]PursuitVehicle, 0, policeCount)
	perps := make([]PursuitVehicle, 0, perpCount)

	for i := 0; i < policeCount; i++ {
		police = append(police, buildPoliceVehicle(i, policeSpawns[i]))
	}
	for i := 0; i < perpCount; i++ {
		perp := buildPerpVehicleAt(i, perpSpawns[i], perpDestinations[i])
		ensurePerpReady(&perp)
		perps = append(perps, perp)
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
		if v.Role != "perp" || v.Status == "caught" || v.Status == "escaped" {
			continue
		}
		ensurePerpReady(v)
		s.advanceVehicle(v, elapsed)
		if v.Destination != nil && haversineMeters(v.Lat, v.Lng, v.Destination.Lat, v.Destination.Lng) <= destArrivalM {
			v.Status = "escaped"
			v.BeingPursued = false
			v.Evaluation = "Suspect evaded — reached destination"
			continue
		}
		perpPositions[v.ID] = LatLng{Lat: v.Lat, Lng: v.Lng}
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

			s.ensurePursuitRoute(v, target)
			s.advanceVehicle(v, elapsed)

			for j := range session.Vehicles {
				perp := &session.Vehicles[j]
				if perp.ID == v.PursuingPerpID && perp.Status != "caught" {
					dist := haversineMeters(v.Lat, v.Lng, perp.Lat, perp.Lng)
					if dist <= pursuitCatchMeters {
						perp.Status = "caught"
						perp.BeingPursued = false
						v.Status = "patrol"
						v.PursuingPerpID = ""
					}
					break
				}
			}
		} else if v.Status == "patrol" {
			s.advanceVehicle(v, elapsed)
		}
	}

	if now.After(session.RoundEndsAt) || allPerpsResolved(session.Vehicles) {
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

	cooldown := time.Now().Add(pursuitCooldownDuration)
	session.CooldownEndsAt = &cooldown
}

func (s *PursuitExamService) advanceVehicle(v *PursuitVehicle, elapsedSec float64) {
	if len(v.Route) < 2 || elapsedSec <= 0 {
		return
	}

	speed := mphToMps(s.operationalSpeedMph(v))
	if speed <= 0 {
		return
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
			if v.Role == "perp" {
				s.maybeAssignPerpDestination(v)
				break
			}
			v.RouteIndex = nextIdx
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
					s.maybeAssignPerpDestination(v)
					break
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
	pos := LatLng{Lat: v.Lat, Lng: v.Lng}
	destDist := 0.0
	if v.Destination != nil {
		destDist = haversineMeters(pos.Lat, pos.Lng, v.Destination.Lat, v.Destination.Lng)
	}
	if v.Destination == nil || destDist < minPerpDestDistanceM*0.9 || destDist <= destArrivalM {
		dest := pickPerpDestination(pos, nil)
		v.Destination = &dest
		v.Route = buildRoadRouteToDestination(pos, dest)
		v.RouteIndex = 0
		v.RouteProgress = 0
		return
	}
	if len(v.Route) < 2 || !routeHasMovement(v.Route) {
		v.Route = buildRoadRouteToDestination(pos, *v.Destination)
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

func olatheMapBounds() (latMin, latMax, lngMin, lngMax float64) {
	return 38.86, 38.91, -94.85, -94.78
}

func snapToRoadGrid(p LatLng) LatLng {
	return LatLng{
		Lat: math.Round(p.Lat/roadGridStep) * roadGridStep,
		Lng: math.Round(p.Lng/roadGridStep) * roadGridStep,
	}
}

func spreadAnchors() []LatLng {
	latMin, latMax, lngMin, lngMax := olatheMapBounds()
	latMid := (latMin + latMax) / 2
	lngMid := (lngMin + lngMax) / 2
	latQ1 := latMin + (latMax-latMin)*0.25
	latQ3 := latMin + (latMax-latMin)*0.75
	lngQ1 := lngMin + (lngMax-lngMin)*0.25
	lngQ3 := lngMin + (lngMax-lngMin)*0.75
	anchors := []LatLng{
		{Lat: latMin, Lng: lngMin},
		{Lat: latMin, Lng: lngMax},
		{Lat: latMax, Lng: lngMin},
		{Lat: latMax, Lng: lngMax},
		{Lat: latMid, Lng: lngMin},
		{Lat: latMid, Lng: lngMax},
		{Lat: latMin, Lng: lngMid},
		{Lat: latMax, Lng: lngMid},
		{Lat: latQ1, Lng: lngQ1},
		{Lat: latQ1, Lng: lngQ3},
		{Lat: latQ3, Lng: lngQ1},
		{Lat: latQ3, Lng: lngQ3},
		{Lat: latMid, Lng: lngMid},
		{Lat: latQ1, Lng: lngMid},
		{Lat: latQ3, Lng: lngMid},
		{Lat: latMid, Lng: lngQ1},
	}
	for i := range anchors {
		anchors[i] = snapToRoadGrid(anchors[i])
	}
	return anchors
}

func mapCorners() []LatLng {
	latMin, latMax, lngMin, lngMax := olatheMapBounds()
	corners := []LatLng{
		{Lat: latMin, Lng: lngMin},
		{Lat: latMin, Lng: lngMax},
		{Lat: latMax, Lng: lngMin},
		{Lat: latMax, Lng: lngMax},
	}
	for i := range corners {
		corners[i] = snapToRoadGrid(corners[i])
	}
	return corners
}

func pickSpreadAnchors(count int, avoid []LatLng) []LatLng {
	anchors := spreadAnchors()
	rand.Shuffle(len(anchors), func(i, j int) { anchors[i], anchors[j] = anchors[j], anchors[i] })
	picked := make([]LatLng, 0, count)
	for _, anchor := range anchors {
		if len(picked) >= count {
			break
		}
		ok := true
		for _, p := range append(avoid, picked...) {
			if haversineMeters(anchor.Lat, anchor.Lng, p.Lat, p.Lng) < minVehicleSpawnSepM {
				ok = false
				break
			}
		}
		if ok {
			picked = append(picked, anchor)
		}
	}
	for _, anchor := range anchors {
		if len(picked) >= count {
			break
		}
		duplicate := false
		for _, p := range picked {
			if p.Lat == anchor.Lat && p.Lng == anchor.Lng {
				duplicate = true
				break
			}
		}
		if !duplicate {
			picked = append(picked, anchor)
		}
	}
	if len(picked) > count {
		picked = picked[:count]
	}
	return picked
}

func pickPerpSpreadSpawns(count int) []LatLng {
	corners := mapCorners()
	rand.Shuffle(len(corners), func(i, j int) { corners[i], corners[j] = corners[j], corners[i] })
	if count > len(corners) {
		count = len(corners)
	}
	return corners[:count]
}

func pickPerpDestination(from LatLng, used []LatLng) LatLng {
	corners := mapCorners()
	type ranked struct {
		corner LatLng
		dist   float64
	}
	rankedCorners := make([]ranked, 0, len(corners))
	for _, c := range corners {
		skip := false
		for _, u := range used {
			if u.Lat == c.Lat && u.Lng == c.Lng {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		rankedCorners = append(rankedCorners, ranked{
			corner: c,
			dist:   haversineMeters(from.Lat, from.Lng, c.Lat, c.Lng),
		})
	}
	if len(rankedCorners) > 0 {
		best := rankedCorners[0]
		for _, r := range rankedCorners[1:] {
			if r.dist > best.dist {
				best = r
			}
		}
		return best.corner
	}
	return farthestMapCorner(from)
}

func assignPerpDestinations(spawns []LatLng) []LatLng {
	used := make([]LatLng, 0, len(spawns))
	destinations := make([]LatLng, 0, len(spawns))
	for _, spawn := range spawns {
		dest := pickPerpDestination(spawn, used)
		used = append(used, dest)
		destinations = append(destinations, dest)
	}
	return destinations
}

func farthestMapCorner(start LatLng) LatLng {
	latMin, latMax, lngMin, lngMax := olatheMapBounds()
	corners := []LatLng{
		{Lat: latMin, Lng: lngMin},
		{Lat: latMin, Lng: lngMax},
		{Lat: latMax, Lng: lngMin},
		{Lat: latMax, Lng: lngMax},
	}
	best := corners[0]
	bestDist := 0.0
	for _, c := range corners {
		d := haversineMeters(start.Lat, start.Lng, c.Lat, c.Lng)
		if d > bestDist {
			bestDist = d
			best = c
		}
	}
	return best
}

func routeHasMovement(route []LatLng) bool {
	for i := 1; i < len(route); i++ {
		if haversineMeters(route[i-1].Lat, route[i-1].Lng, route[i].Lat, route[i].Lng) > 40 {
			return true
		}
	}
	return false
}

func ensurePerpReady(v *PursuitVehicle) {
	if v.Role != "perp" || v.Status == "caught" || v.Status == "escaped" {
		return
	}
	if v.Status != "patrol" {
		v.Status = "patrol"
	}
	pos := LatLng{Lat: v.Lat, Lng: v.Lng}
	destDist := 0.0
	if v.Destination != nil {
		destDist = haversineMeters(pos.Lat, pos.Lng, v.Destination.Lat, v.Destination.Lng)
	}
	if v.Destination == nil || destDist < minPerpDestDistanceM*0.9 || destDist <= destArrivalM {
		dest := pickPerpDestination(pos, nil)
		v.Destination = &dest
	}
	if len(v.Route) < 2 || !routeHasMovement(v.Route) {
		v.Route = buildRoadRouteToDestination(pos, *v.Destination)
		v.RouteIndex = 0
		v.RouteProgress = 0
	}
}

func schedulePoliceDowns(vehicles []PursuitVehicle, roundStart time.Time) {
	policeIDs := []string{}
	for i := range vehicles {
		if vehicles[i].Role == "police" {
			policeIDs = append(policeIDs, vehicles[i].ID)
		}
	}
	if len(policeIDs) < 2 {
		return
	}
	downCount := 1 + rand.Intn(2)
	if downCount > len(policeIDs)-1 {
		downCount = len(policeIDs) - 1
	}
	if downCount < 1 {
		return
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

func buildPerpVehicleAt(index int, start, dest LatLng) PursuitVehicle {
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
	latMin, latMax, lngMin, lngMax := olatheMapBounds()
	route := []LatLng{start}
	cur := start
	end := dest
	preferLat := rand.Float64() > 0.5
	for safety := 0; safety < 280 && haversineMeters(cur.Lat, cur.Lng, end.Lat, end.Lng) > 60; safety++ {
		dLat := end.Lat - cur.Lat
		dLng := end.Lng - cur.Lng
		next := cur
		moveLat := math.Abs(dLat) >= roadGridStep*0.4
		moveLng := math.Abs(dLng) >= roadGridStep*0.4
		if moveLat && moveLng {
			if preferLat {
				next.Lat += math.Copysign(roadGridStep, dLat)
				preferLat = false
			} else {
				next.Lng += math.Copysign(roadGridStep, dLng)
				preferLat = true
			}
		} else if moveLng {
			next.Lng += math.Copysign(roadGridStep, dLng)
		} else if moveLat {
			next.Lat += math.Copysign(roadGridStep, dLat)
		} else {
			break
		}
		next.Lat = clamp(next.Lat, latMin, latMax)
		next.Lng = clamp(next.Lng, lngMin, lngMax)
		route = append(route, next)
		cur = next
	}
	route = append(route, end)
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

func allPerpsResolved(vehicles []PursuitVehicle) bool {
	total := 0
	for i := range vehicles {
		if vehicles[i].Role != "perp" {
			continue
		}
		total++
		if vehicles[i].Status != "caught" && vehicles[i].Status != "escaped" {
			return false
		}
	}
	return total > 0
}

func (s *PursuitExamService) operationalSpeedMph(v *PursuitVehicle) float64 {
	if v.Status == "caught" || v.Status == "escaped" || v.Status == "down" {
		return 0
	}
	mph := perpCruiseMph
	if v.Role == "police" {
		if v.Status == "pursuing" {
			mph = (v.MaxSpeedMph*policePursuitMultiplier + policePursuitBonusMph) * pursuitClosureBoost
		} else {
			mph = patrolCruiseMph
		}
	} else if v.BeingPursued {
		mph = v.MaxSpeedMph * perpFleeMultiplier
	}
	return mph * simMovementScale
}

func (s *PursuitExamService) ensurePursuitRoute(v *PursuitVehicle, target LatLng) {
	if len(v.Route) == 0 {
		v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, target)
		v.RouteIndex = 0
		v.RouteProgress = 0
		return
	}
	end := v.Route[len(v.Route)-1]
	if haversineMeters(end.Lat, end.Lng, target.Lat, target.Lng) > pursuitRouteRebuildM {
		v.Route = buildRoadRouteToDestination(LatLng{Lat: v.Lat, Lng: v.Lng}, target)
		v.RouteIndex = 0
		v.RouteProgress = 0
	}
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
