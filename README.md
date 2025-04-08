# Timeline-Based Sankey Diagram

This visualization displays projects on a timeline with Sankey-style flow connections between them. Projects are positioned horizontally based on their start and end dates.

## Key Features

- Timeline-based layout: Projects are positioned horizontally based on their start/end dates
- Animated connections: Hover over or click on a project to see its connections animate
- Intuitive data format: Projects and connections are structured in JSON

## File Structure

- `timeline-sankey.js`: Main visualization code
- `project-data.json`: JSON file containing project data
- `index.html`: Web page layout

## Data Format

The visualization reads from a JSON file named `project-data.json` with the following structure:

```json
{
  "id": "project-1",
  "name": "Project A",
  "startDate": "2025-02-18",
  "endDate": "2025-04-01",
  "duration": "6 weeks",
  "category": "M",
  "phase": 1,
  "description": "Text description",
  "skills": ["Data Engineering", "ML", "Dashboard", "Database", "Cloud Architecture"]
},
{
  "id": "project-2",
  "name": "Project B",
  "startDate": "2025-03-18",
  "endDate": "2025-04-08",
  "duration": "6.3 weeks",
  "category": "M",
  "phase": 1,
  "description": "Text description",
  "skills": ["Web Scraping"]
},
```

### Project Properties

- `id`: Unique identifier for the project
- `name`: Display name
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format
- `duration`: Length of the project in weeks
- `category`: "T-Shit size" assigned to the project on Confluence
- `phase`: Numeric value representing the number of project phases
- `description`: Brief description pulled from the project "Goal" on Confluence
- `skills`: Skills used to complete the project

### Connection Properties

- `source`: ID of the source project
- `target`: ID of the target project
- `value`: Numeric value representing the strength of the connection

## Running the Visualization

To run this visualization:

1. Ensure all files are in the same directory
2. Edit `project-data.json` to include your project data
3. Start a local web server in this directory, for example:
   ```sh
   npx http-server
   ```
4. Open a browser and navigate to the local server address 

## Dependencies

- D3.js (version 6)

## Acknowledgements

This visualization is based on the Observable notebook "[Sankey With Animated Gradients](https://observablehq.com/@jarrettmeyer/sankey-with-animated-gradients)" by Jarrett Meyer, adapted to position projects on a timeline.