Release:
- verify release is present on event [DONE]
Frame:
- verify stacktrace path (incorrect protocol) [DONE]
  - if using invalid one (znalezc ta rozmowe o app:/// przy rewriteframes na Discordzie) [DONE]
- verify some files are uploaded [DONE]
Upload:
- verify file with specific path is uploaded [DONE]
  - if not, is there a file with the same name? [DONE]
    - if not [error] [DONE]
Dist:
    - if yes, does it have a dist? [DONE]
      - if not/different, and event have dist [error] [DONE]
      - if yes, and event have no/different dist [error] [DONE]
Verify source maps resolve correctly:
- If everything is fine, but has invalid location error, try to resolve locally and print the output;
- Does the sourcemap have sourcesContent and if not, are the original source files uploaded;
