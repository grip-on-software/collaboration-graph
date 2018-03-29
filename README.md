# Collaboration Graph

A directed graph of relations between project members and the projects they work on.

# Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental
settings in that file. The current configuration options are:

- `"encrypt_url"`: Prefix for the encryption endpoint server to connect to 
  request the encrypted version of a name for searching purposes. The server 
  must provide the JSON result (an object containing "encryption" level and 
  "value" with the encrypted variant) on a URL which is given the unencrypted
  "value" in a query string.
- `"visualization_url"`: URL to the visualization site holding shared assets.
- `"path"`: Assets path to prefix the URLs of the bundles with.
- `"lower_names"`: Parts of person (family) names that should remain lowercased
