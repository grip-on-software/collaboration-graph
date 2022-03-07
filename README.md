# Collaboration Graph

This visualization produces a directed graph of relations between project 
members and the projects they work on.

## Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental
settings in that file. The current configuration options are:

- `encrypt_url`: The URL prefix for the encryption endpoint server to connect 
  to request the encrypted version of a name for searching purposes. The server 
  must have this JSON endpoint, when given the unencrypted `value` in a query 
  string, provide a result, which is a JSON object containing two items: the 
  the encrypted variant of the provided value with the key `value`, and the 
  encryption level of this variant with the `ecncryption` key. If the URL is an 
  empty string, then searching for persons with encrypted names in the graph is 
  not possible.
- `visualization_url`: The URL to the visualization hub. This may include 
  a protocol and domain name, but does not need to in case all the 
  visualizations and the collaboration graph are hosted on the same domain (for 
  example in a development environment). The remainder is a path to the root of 
  the visualizations, where the dashboard is found and every other 
  visualization has sub-paths below it.
- `path`: The relative path at which the collaboration graph is made available 
  on the server. This can remain the default `.` to work just fine.
- `lower_names`: An array of strings with parts of person (family) names that 
  should remain lowercased when trying to search a person through its encrypted 
  variant.

## Data

The data for the collaboration graph can be analyzed and output through runs of 
scripts from the `data-analysis` repository upon a collection of Scrum data in 
a Grip on Software database. The `project_members` analysis report in that 
repository can export the sprint data in the JSON formats that is expected by 
the sprint report. Using the `--interval` argument on the `report.r` script, 
intervals of project membership data can be collected for the timelapse 
function of the collaboration graph. The entire data collection must be placed 
in the `public/data` directory.

## Running

The visualization can be built using Node.js and `npm` by running `npm install` 
and then either `npm run watch` to start a development server that also 
refreshes browsers upon code changes, or `npm run production` to create 
a minimized bundle. The resulting HTML, CSS and JavaScript is made available in 
the `public` directory.

This repository also contains a `Dockerfile` specification for a Docker image 
that can performs the installation of the app and dependencies, which allows 
building the visualization within there. Additionally, a `Jenkinsfile` contains 
appropriate steps for a Jenkins CI deployment, including data collection and 
visualization building.
