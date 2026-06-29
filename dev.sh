#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Open backend in a new Terminal window
osascript -e "
tell application \"Terminal\"
    do script \"cd '$PROJECT_DIR/backend' && source env/bin/activate && python manage.py runserver 8000\"
    activate
end tell
"

# Open frontend in another new Terminal window
osascript -e "
tell application \"Terminal\"
    do script \"cd '$PROJECT_DIR/frontend' && npm run dev\"
    activate
end tell
"

echo "✅ Backend and Frontend started in separate Terminal windows."
