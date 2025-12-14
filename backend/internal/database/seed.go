package database

import (
	"database/sql"
	"log"
	"time"
)

// SeedDatabase populates the database with mock data for demonstration
func SeedDatabase(db *sql.DB) error {
	// Check if data already exists
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM cases").Scan(&count)
	if err == nil && count > 0 {
		log.Println("Database already contains data, skipping seed")
		return nil
	}

	log.Println("Seeding database with Olathe PD mock data...")

	// Seed Cases
	if err := seedCases(db); err != nil {
		return err
	}

	// Seed Perps
	if err := seedPerps(db); err != nil {
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
		{"case-001", "Armed Assault", "123 S Kansas Ave, Olathe", "2023-11-15", "Solved", "Armed robbery at convenience store. Olathe PD apprehended suspect.", 1},
		{"case-002", "Robbery", "456 E Santa Fe St, Olathe", "2023-10-20", "Solved", "Store robbery during business hours. Multiple witnesses.", 1},
		{"case-003", "Murder", "789 N Ridgeview Rd, Olathe", "2023-09-05", "Unsolved", "Homicide case. Olathe PD investigation ongoing.", 0},
		{"case-004", "Sexual Assault", "321 W Park St, Olathe", "2023-08-12", "Solved", "Assault case resolved. Perpetrator in custody.", 1},
		{"case-005", "Armed Assault", "654 S Mur-Len Rd, Olathe", "2023-12-01", "Open", "Recent armed assault. Olathe PD active investigation.", 0},
		{"case-006", "Robbery", "987 E 151st St, Olathe", "2023-11-28", "Solved", "Bank robbery attempt. Olathe PD arrested suspects.", 1},
		{"case-007", "Murder", "147 N Black Bob Rd, Olathe", "2023-07-20", "Unsolved", "Cold case. Olathe PD reviewing evidence.", 0},
		{"case-008", "Armed Assault", "258 W 119th St, Olathe", "2024-01-10", "Open", "Ongoing investigation. Multiple suspects.", 0},
		{"case-009", "Robbery", "369 S Parker St, Olathe", "2023-12-15", "Solved", "Gas station robbery. Case closed by Olathe PD.", 1},
		{"case-010", "Sexual Assault", "741 E Dennis Ave, Olathe", "2023-10-05", "Solved", "Assault case. Perpetrator convicted.", 1},
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
		{"perp-001", "Subject Alpha", "Downtown Olathe", "2024-01-15", "Active"},
		{"perp-002", "Subject Bravo", "North Olathe", "2024-01-10", "Wanted"},
		{"perp-003", "Subject Charlie", "East Olathe", "2023-12-20", "In Custody"},
		{"perp-004", "Subject Delta", "South Olathe", "2024-01-05", "Active"},
		{"perp-005", "Subject Echo", "West Olathe", "2023-12-28", "Wanted"},
		{"perp-006", "Subject Foxtrot", "Central Olathe", "2024-01-12", "Active"},
		{"perp-007", "Subject Golf", "North Olathe", "2023-11-15", "In Custody"},
		{"perp-008", "Subject Hotel", "Downtown Olathe", "2024-01-18", "Wanted"},
		{"perp-009", "Subject India", "East Olathe", "2023-12-10", "Active"},
		{"perp-010", "Subject Juliet", "South Olathe", "2024-01-08", "In Custody"},
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
