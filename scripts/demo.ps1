$ErrorActionPreference = 'Stop'

Write-Host "[1/4] Healthy fixture — expected exit code 0"
node .\dist\cli.js check .\demo\repository\healthy --registry .\demo\registry.fixture.json
if ($LASTEXITCODE -ne 0) { throw "Healthy demo failed with exit code $LASTEXITCODE" }

Write-Host "`n[2/4] Retired fixture — expected exit code 1"
node .\dist\cli.js check .\demo\repository\retired --registry .\demo\registry.fixture.json
if ($LASTEXITCODE -ne 1) { throw "Retired demo should exit 1, got $LASTEXITCODE" }

Write-Host "`n[3/4] Real official-snapshot lifecycle sample — expected exit code 1"
node .\dist\cli.js check .\demo\repository\real-lifecycle --registry .\data\registry.json
if ($LASTEXITCODE -ne 1) { throw "Real lifecycle sample should surface retired models with exit code 1, got $LASTEXITCODE" }

Write-Host "`n[4/4] Migration plan + failing eval gate"
node .\dist\cli.js plan .\demo\repository\migration-breaks-tool-use --registry .\demo\registry.fixture.json --output .\demo\migration-plan.json
if ($LASTEXITCODE -ne 0) { throw "Plan generation failed with exit code $LASTEXITCODE" }
node .\dist\cli.js verify --plan .\demo\migration-plan.json --registry .\demo\registry.fixture.json --command "node ../../evals/run.mjs migration-breaks-tool-use" --output .\demo\evidence.json --format json
if ($LASTEXITCODE -ne 1) { throw "Migration gate should block with exit code 1, got $LASTEXITCODE" }

Write-Host "`nAll demo expectations matched. The retired lifecycle and eval failures above are intentional."
