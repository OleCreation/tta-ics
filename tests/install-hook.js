// ==========================================
// GIT HOOK INSTALLER
// Installs the pre-push hook into .git/hooks/pre-push
// ==========================================

const fs = require('fs');
const path = require('path');

const hookDir = path.resolve(__dirname, '../.git/hooks');
const hookFile = path.join(hookDir, 'pre-push');

const hookScript = `#!/bin/sh
# ==========================================
# AUTO PRE-PUSH TEST RUNNER FOR TTA-APP
# Blocks git push if any tests fail
# ==========================================

echo ""
echo "🔍 Kjører full testsuite før git push..."
echo "----------------------------------------"

node --test tests/**/*.test.js

RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "❌ PUSH AVBRUTT: Én eller flere tester feilet!"
    echo "💡 Rett feilene ovenfor og kjør 'npm test' for å verifisere før du pusher på nytt."
    echo ""
    exit 1
fi

echo ""
echo "✅ Alle tester bestått! Fortsetter git push..."
echo "----------------------------------------"
echo ""
exit 0
`;

try {
    if (!fs.existsSync(hookDir)) {
        fs.mkdirSync(hookDir, { recursive: true });
    }
    fs.writeFileSync(hookFile, hookScript, { encoding: 'utf8', mode: 0o755 });
    console.log('✅ Git pre-push hook installert i:', hookFile);
} catch (err) {
    console.error('❌ Kunne ikke installere git hook:', err.message);
    process.exit(1);
}
