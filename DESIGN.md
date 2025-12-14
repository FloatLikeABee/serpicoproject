# Serpico - Design Document v0.1

## Project Overview
Serpico is an AI Agent assistant helper application designed for police forces on patrol or in office use, as well as for civilians to check nearby safety status with AI assistance.

## Design Philosophy
Based on the grand design concept, the application follows a data-driven AI approach with the following core principles:

### Data Flow Architecture
1. **Data Ingestion Layer**
   - Real cases data collection
   - Study real case data and extract keys
   - Categorize by locations
   - Create RAG (Retrieval Augmented Generation) vector base

2. **AI Processing Layer**
   - Chat AI interface for user interaction
   - Categorize prompts (patrol/taskforce/general)
   - Push emergency notifications with AI categorization
   - Query for in-range information
   - Query with search engine agents for recent cases
   - AI pop-up for nearby suspects

3. **Output & Recommendations**
   - Nearby riders/hot for pursue
   - Recommendations for safe routes
   - Recommendations for pursuing based on history data

## Application Architecture

### Frontend (ReactJS)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with custom theme (red/blue color scheme)
- **Mobile**: Responsive design with mobile-first approach
- **State Management**: React Context API or Redux
- **Map Integration**: React Leaflet with OpenStreetMap tiles
- **Theme**: Light/Dark mode toggle

### Backend (Golang)
- **Framework**: Gin or Echo for HTTP routing
- **Database**: 
  - Embedded key-value store (BadgerDB or BoltDB) for caching
  - SQLite for structured data (cases, users, etc.)
- **AI Integration**: OpenAI API or similar for chat functionality
- **Vector Database**: For RAG implementation (embedded or external)
- **API Documentation**: SwaggerUI integration
- **Concurrency**: Goroutines for async operations

## User Interface Design

### Logo & Branding
- **Logo**: Shield design inspired by Captain America's shield
- **Colors**: 
  - Primary Red: #DC2626 (eye-friendly, not too sharp)
  - Primary Blue: #2563EB (eye-friendly, not too sharp)
  - Accent colors for light/dark mode variants
- **Typography**: Modern, readable sans-serif font

### Layout Structure

#### Default Home Screen (Map Canvas)
- **For Police**: "In Pursue" view
  - Active cases and pursuits displayed on map
  - Real-time AI chat suggestions in drawer
  - AI-recommended pursuit routes from history
  
- **For Civilians**: "Nearby Safety" view
  - Nearby officers/police vehicles
  - Possible dangers (pursuits, discovered criminal activity)
  - AI chat drawer with officer information

#### Navigation
- Bottom navigation bar (mobile) or sidebar (desktop)
- Drawer button for AI chat (always accessible)
- Settings icon in header

### Module Design

#### Police Modules

1. **In Pursue**
   - Map canvas with active cases
   - Real-time location tracking
   - AI chat drawer with:
     - Nearby suspect suggestions
     - Organized prompts by category
     - Historical pursuit route recommendations

2. **Perps**
   - AI chat interface
   - Database of perps from cases (last 3 years, configurable)
   - Search and filter capabilities

3. **Case Library**
   - AI chat for historical cases
   - Search and wiki functionality
   - Focus categories:
     - Armed/unarmed assaults
     - Sexual assaults
     - Murders
     - Robberies
   - Includes unsolved cases

4. **Emergency Notification / 911 Dispatch**
   - AI-categorized notifications
   - Suggestions by officer rank/ability
   - Real-time location-based alerts
   - Priority system

5. **Leisure**
   - AI chat for:
     - After-hour workouts
     - Training information
     - Healthcare advice for police forces
     - Bars and clubs
     - Social activities
   - AI agent with search tool

#### Civilian Modules

1. **Nearby Officers/Police Vehicles**
   - Map canvas with officer locations
   - AI chat drawer showing:
     - Officer names/ranks
     - Vehicle plate numbers
     - Vehicle numbers
   - Real-time danger alerts (pursuits, criminal activity)

2. **Nearby Perps/Criminals**
   - Recent history events (last 3 years, configurable)
   - Privacy-compliant display (covered names/faces)
   - Public list exceptions (official police department releases)

3. **Safe Route Recommendations**
   - AI-powered route suggestions
   - Avoidance of known danger zones
   - Real-time updates

4. **Crime Notifications**
   - Nearby crime alerts
   - Categorized by severity
   - Location-based filtering

#### Common Modules

1. **Settings**
   - User profile management
   - Theme toggle (light/dark mode)
   - Notification preferences
   - Location permissions
   - Data privacy settings

2. **Login/Authentication** (Mock)
   - Email and password fields
   - Sign in with Google button
   - Sign in with Apple button
   - All authentication is mocked - single button login

## Technical Specifications

### Data Models

#### User
- ID, Email, Name, Role (police/civilian), Rank (for police), Location

#### Case
- ID, Type, Location, Date, Status, Description, Related Perps, Solved/Unsolved

#### Perp
- ID, Alias (for privacy), Location, Related Cases, Last Seen, Status

#### Officer
- ID, Name, Rank, Vehicle Info, Current Location, Status

#### Emergency
- ID, Type, Location, Priority, Category, Timestamp, Assigned Officer

### API Endpoints Structure

```
/api/v1/
  /auth (mock endpoints)
  /users
  /cases
  /perps
  /officers
  /emergencies
  /chat (AI chat endpoints)
  /recommendations
  /routes
```

### AI Integration Points

1. **Chat Interface**
   - Context-aware responses
   - Module-specific prompts
   - RAG-based retrieval

2. **Recommendations**
   - Route recommendations
   - Pursuit suggestions
   - Safety alerts

3. **Categorization**
   - Emergency categorization
   - Case classification
   - Threat assessment

## Security & Privacy Considerations

- All user data encrypted at rest
- Location data anonymized where appropriate
- Perp data privacy-compliant (no faces/names unless public)
- Secure API endpoints (even in mock mode)
- Role-based access control

## Future Enhancements (Post v0.1)

- Real authentication system
- Real-time WebSocket connections
- Advanced AI model fine-tuning
- Integration with actual police databases
- Push notifications
- Offline mode support
- Advanced analytics dashboard

