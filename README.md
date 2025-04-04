# Timeline-Based Sankey Diagram

This visualization displays projects on a timeline with Sankey-style flow connections between them. Projects are positioned horizontally based on their start and end dates, and vertically by their phase/category.

## Key Features

- Timeline-based layout: Projects are positioned horizontally based on their start/end dates
- Phase organization: Projects are grouped vertically by phase
- Animated connections: Hover over a project to see its connections animate
- Intuitive data format: Projects and connections use IDs rather than array indices

## File Structure

- `timeline-sankey.js`: Main visualization code
- `project-data.json`: JSON file containing project data
- `index.js`: Entry point for the Observable notebook
- `runtime.js` and `inspector.css`: Observable runtime files
- `package.json`: Project metadata

## Data Format

The visualization reads from a JSON file named `project-data.json` with the following structure:

```json
{
  "projects": [
    {
      "id": "project-a",
      "name": "Project A",
      "startDate": "2023-01-01",
      "endDate": "2023-03-15",
      "duration": 73,
      "category": "research",
      "phase": 1
    },
    ...
  ],
  "connections": [
    {
      "source": "project-a",
      "target": "project-b",
      "value": 40
    },
    ...
  ]
}
```

### Project Properties

- `id`: Unique identifier for the project
- `name`: Display name
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format
- `duration`: Length of the project (typically in days)
- `category`: Category/type of project (used for grouping or coloring)
- `phase`: Numeric value representing the phase

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

## Modifying the Visualization

The most common modifications include:

- Editing `project-data.json` to update project data
- Adjusting the `height`, `margin`, and `duration` variables in the main module
- Customizing the color scheme by modifying the `color` function
- Changing link curve shapes by adjusting the `createLinkPath` function

## Dependencies

- D3.js (version 6)

## Acknowledgements

This visualization is based on the Observable notebook "[Sankey With Animated Gradients](https://observablehq.com/@jarrettmeyer/sankey-with-animated-gradients)" by Jarrett Meyer, adapted to position projects on a timeline.