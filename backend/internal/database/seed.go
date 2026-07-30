package database

import (
	"database/sql"
	"log"
	"time"
)

// SeedDatabase populates the database with mock data for demonstration
func SeedDatabase(db *sql.DB) error {
	// Gate on users — investigation cases intentionally start empty.
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err == nil && count > 0 {
		log.Println("Database already contains data, skipping seed")
		return nil
	}

	log.Println("Seeding database with serial killers and mysteries data...")

	// Investigation Cases start empty — officers create their own from the Cases desk.
	// (Do not seed example cases into the cases table.)

	// Seed Perps (Serial Killers)
	if err := seedPerps(db); err != nil {
		return err
	}

	// Seed Mysteries
	if err := seedMysteries(db); err != nil {
		return err
	}

	// Seed Officers
	if err := seedOfficers(db); err != nil {
		return err
	}

	// Seed Emergencies
	if err := seedEmergencies(db); err != nil {
		return err
	}

	// Seed Users
	if err := seedUsers(db); err != nil {
		return err
	}

	log.Println("Database seeded successfully")
	return nil
}

func seedCases(db *sql.DB) error {
	cases := []struct {
		id          string
		caseType    string
		location    string
		date        string
		status      string
		description string
		solved      int
	}{
		{"case-001", "Serial Murder", "Seattle, Washington", "1974-01-31", "Solved", "Ted Bundy's first confirmed victim. Multiple murders across several states.", 1},
		{"case-002", "Serial Murder", "Los Angeles, California", "1969-08-09", "Solved", "Sharon Tate murder - part of Manson Family killing spree.", 1},
		{"case-003", "Serial Murder", "Chicago, Illinois", "1978-12-11", "Solved", "John Wayne Gacy victim discovered. 33 total victims found.", 1},
		{"case-004", "Serial Murder", "Milwaukee, Wisconsin", "1991-07-22", "Solved", "Jeffrey Dahmer's apartment discovered with human remains.", 1},
		{"case-005", "Serial Murder", "Wichita, Kansas", "1974-01-15", "Solved", "BTK Killer's first murders. Dennis Rader confessed to 10 murders.", 1},
		{"case-006", "Serial Murder", "Green River, Washington", "1982-08-15", "Solved", "Green River Killer - Gary Ridgway murdered 49+ women.", 1},
		{"case-007", "Serial Murder", "Anchorage, Alaska", "1980-06-13", "Solved", "Robert Hansen's hunting ground murders. 17+ victims.", 1},
		{"case-008", "Serial Murder", "Sacramento, California", "1978-02-02", "Solved", "Golden State Killer - Joseph DeAngelo. 13 murders, 50+ rapes.", 1},
		{"case-009", "Serial Murder", "Portland, Oregon", "2023-12-15", "Open", "Recent pattern of unsolved murders. Possible serial killer active.", 0},
		{"case-010", "Serial Murder", "Phoenix, Arizona", "2024-01-05", "Open", "Multiple bodies found with similar MO. Investigation ongoing.", 0},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO cases (id, type, location, date, status, description, solved) VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, c := range cases {
		_, err := stmt.Exec(c.id, c.caseType, c.location, c.date, c.status, c.description, c.solved)
		if err != nil {
			log.Printf("Error seeding case %s: %v", c.id, err)
		}
	}

	return nil
}

func seedPerps(db *sql.DB) error {
	perps := []struct {
		id        string
		alias     string
		location  string
		lastSeen  string
		status    string
	}{
		{"perp-001", "Ted Bundy", "Florida State Prison", "1989-01-24", "Executed"},
		{"perp-002", "John Wayne Gacy", "Illinois State Prison", "1994-05-10", "Executed"},
		{"perp-003", "Jeffrey Dahmer", "Columbia Correctional", "1994-11-28", "Deceased"},
		{"perp-004", "Dennis Rader (BTK)", "El Dorado Correctional", "2005-02-25", "In Custody"},
		{"perp-005", "Gary Ridgway (Green River)", "Washington State Penitentiary", "2001-11-30", "In Custody"},
		{"perp-006", "Joseph DeAngelo (Golden State)", "California State Prison", "2018-04-24", "In Custody"},
		{"perp-007", "Richard Ramirez (Night Stalker)", "San Quentin State Prison", "2013-06-07", "Deceased"},
		{"perp-008", "David Berkowitz (Son of Sam)", "Sullivan Correctional", "1977-08-10", "In Custody"},
		{"perp-009", "Edmund Kemper", "California Medical Facility", "1973-11-08", "In Custody"},
		{"perp-010", "Aileen Wuornos", "Florida State Prison", "2002-10-09", "Executed"},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO perps (id, alias, location, last_seen, status) VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, p := range perps {
		_, err := stmt.Exec(p.id, p.alias, p.location, p.lastSeen, p.status)
		if err != nil {
			log.Printf("Error seeding perp %s: %v", p.id, err)
		}
	}

	return nil
}

func seedOfficers(db *sql.DB) error {
	// Olathe PD officers with Olathe coordinates
	officers := []struct {
		id              string
		name            string
		rank            string
		vehiclePlate    string
		vehicleNumber   string
		currentLocation string
		status          string
	}{
		{"officer-001", "Officer Sarah Smith", "Sergeant", "OPD-1234", "1234", "38.8814,-94.8191", "On Duty"},
		{"officer-002", "Officer Michael Johnson", "Officer", "OPD-5678", "5678", "38.8914,-94.8091", "On Duty"},
		{"officer-003", "Officer Emily Davis", "Lieutenant", "OPD-9012", "9012", "38.8714,-94.8291", "On Duty"},
		{"officer-004", "Officer James Wilson", "Officer", "OPD-3456", "3456", "38.9014,-94.7991", "On Patrol"},
		{"officer-005", "Officer Lisa Anderson", "Sergeant", "OPD-7890", "7890", "38.8614,-94.8391", "On Duty"},
		{"officer-006", "Officer Robert Brown", "Officer", "OPD-2468", "2468", "38.9114,-94.7891", "On Patrol"},
		{"officer-007", "Officer Jennifer Martinez", "Captain", "OPD-1357", "1357", "38.8514,-94.8491", "On Duty"},
		{"officer-008", "Officer David Taylor", "Officer", "OPD-8024", "8024", "38.9214,-94.7791", "On Patrol"},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO officers (id, name, rank, vehicle_plate, vehicle_number, current_location, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, o := range officers {
		_, err := stmt.Exec(o.id, o.name, o.rank, o.vehiclePlate, o.vehicleNumber, o.currentLocation, o.status)
		if err != nil {
			log.Printf("Error seeding officer %s: %v", o.id, err)
		}
	}

	return nil
}

func seedEmergencies(db *sql.DB) error {
	now := time.Now()
	emergencies := []struct {
		id             string
		emergencyType  string
		location       string
		priority       string
		category       string
		assignedOfficer string
		status         string
		createdAt      time.Time
	}{
		{"emergency-001", "Armed Robbery", "123 S Kansas Ave, Olathe", "High", "Crime", "officer-001", "Active", now.Add(-2 * time.Minute)},
		{"emergency-002", "Domestic Disturbance", "456 E Santa Fe St, Olathe", "Medium", "Domestic", "officer-002", "Active", now.Add(-5 * time.Minute)},
		{"emergency-003", "Traffic Accident", "789 N Ridgeview Rd, Olathe", "Low", "Traffic", "officer-004", "Active", now.Add(-10 * time.Minute)},
		{"emergency-004", "Burglary in Progress", "321 W Park St, Olathe", "High", "Crime", "officer-003", "Active", now.Add(-15 * time.Minute)},
		{"emergency-005", "Suspicious Activity", "654 S Mur-Len Rd, Olathe", "Medium", "General", "officer-005", "Active", now.Add(-20 * time.Minute)},
		{"emergency-006", "Assault", "987 E 151st St, Olathe", "High", "Crime", "officer-006", "Active", now.Add(-25 * time.Minute)},
		{"emergency-007", "Vandalism", "147 N Black Bob Rd, Olathe", "Low", "Property", "", "Pending", now.Add(-30 * time.Minute)},
		{"emergency-008", "Drug Activity", "258 W 119th St, Olathe", "Medium", "Crime", "officer-007", "Active", now.Add(-35 * time.Minute)},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO emergencies (id, type, location, priority, category, assigned_officer_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, e := range emergencies {
		_, err := stmt.Exec(e.id, e.emergencyType, e.location, e.priority, e.category, e.assignedOfficer, e.status, e.createdAt.Format(time.RFC3339))
		if err != nil {
			log.Printf("Error seeding emergency %s: %v", e.id, err)
		}
	}

	return nil
}

func seedUsers(db *sql.DB) error {
	users := []struct {
		id    string
		email string
		name  string
		role  string
		rank  string
	}{
		{"user-001", "officer.smith@olathepd.gov", "Officer Sarah Smith", "police", "Sergeant"},
		{"user-002", "officer.johnson@olathepd.gov", "Officer Michael Johnson", "police", "Officer"},
		{"user-003", "civilian.demo@serpico.com", "Demo Civilian", "civilian", ""},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO users (id, email, name, role, rank) VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, u := range users {
		_, err := stmt.Exec(u.id, u.email, u.name, u.role, u.rank)
		if err != nil {
			log.Printf("Error seeding user %s: %v", u.id, err)
		}
	}

	return nil
}

func seedMysteries(db *sql.DB) error {
	mysteries := []struct {
		id          string
		title       string
		category    string
		location    string
		date        string
		description string
		credibility string
		source      string
	}{
		{"mystery-001", "The Mothman Sightings", "paranormal", "Point Pleasant, West Virginia", "2024-01-15", "Multiple eyewitness reports of a large winged creature with glowing red eyes. First reported in 1966, sightings continue to this day across the Ohio River Valley.", "High", "Multiple eyewitnesses, documented since 1966"},
		{"mystery-002", "The Philadelphia Experiment", "conspiracy", "Philadelphia, Pennsylvania", "2024-01-10", "Alleged 1943 US Navy experiment that made destroyer USS Eldridge invisible. Classified documents suggest possible truth behind the legend.", "Medium", "Military whistleblowers, declassified documents"},
		{"mystery-003", "The Vanishing Hitchhiker", "urban-legend", "Various locations, North America", "2024-01-08", "Classic urban legend of a hitchhiker who disappears from moving vehicles. Reported across multiple states with similar details.", "Low", "Folklore, oral tradition"},
		{"mystery-004", "Skinwalker Ranch", "paranormal", "Ballard, Utah", "2024-01-05", "Ranch with documented UFO sightings, strange creatures, and unexplained phenomena. Ongoing scientific investigation by multiple teams.", "High", "Scientific documentation, multiple researchers"},
		{"mystery-005", "Area 51 Secrets", "conspiracy", "Groom Lake, Nevada", "2024-01-03", "Alleged reverse engineering of alien technology. Multiple whistleblower testimonies suggest hidden programs and recovered craft.", "Medium", "Whistleblower testimonies, government secrecy"},
		{"mystery-006", "The Bell Witch", "paranormal", "Adams, Tennessee", "2023-12-28", "One of America's most documented poltergeist cases. Haunting of the Bell family in the early 1800s, witnessed by multiple people including Andrew Jackson.", "High", "Historical documentation, multiple witnesses"},
		{"mystery-007", "The Dyatlov Pass Incident", "conspiracy", "Ural Mountains, Russia", "2023-12-20", "Nine hikers found dead in 1959 under mysterious circumstances. Official cause: avalanche, but evidence suggests otherwise.", "High", "Official investigation files, forensic evidence"},
		{"mystery-008", "The Jersey Devil", "urban-legend", "Pine Barrens, New Jersey", "2023-12-15", "Legendary creature said to inhabit the Pine Barrens. Sightings date back to 1735, with modern reports continuing.", "Medium", "Historical records, modern sightings"},
		{"mystery-009", "MK-Ultra Program", "conspiracy", "Various locations, USA", "2023-12-10", "CIA mind control program declassified in 1970s. Experiments on unwitting subjects suggest deeper, ongoing programs.", "High", "Declassified documents, congressional hearings"},
		{"mystery-010", "The Black Eyed Children", "paranormal", "Various locations, North America", "2023-12-05", "Modern urban legend of children with completely black eyes appearing at doors and asking for entry. Reports span multiple states.", "Low", "Modern eyewitness reports"},
		{"mystery-011", "The Roswell Incident", "conspiracy", "Roswell, New Mexico", "2023-11-28", "Alleged 1947 UFO crash and government cover-up. Multiple witnesses, conflicting official statements.", "High", "Military personnel testimonies, official documents"},
		{"mystery-012", "The Amityville Horror", "paranormal", "Amityville, New York", "2023-11-20", "Infamous haunted house case from 1974. Family fled after 28 days, claiming paranormal activity. Multiple investigations.", "Medium", "Family testimonies, paranormal investigations"},
	}

	stmt, err := db.Prepare(`INSERT OR IGNORE INTO mysteries (id, title, category, location, date, description, credibility, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, m := range mysteries {
		_, err := stmt.Exec(m.id, m.title, m.category, m.location, m.date, m.description, m.credibility, m.source)
		if err != nil {
			log.Printf("Error seeding mystery %s: %v", m.id, err)
		}
	}

	return nil
}
