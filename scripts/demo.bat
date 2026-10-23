@echo off
setlocal
node dist\cli.js check demo\repository\healthy --registry demo\registry.fixture.json
if errorlevel 1 exit /b 1
node dist\cli.js check demo\repository\retired --registry demo\registry.fixture.json
if not errorlevel 1 (
  echo Expected retired fixture to fail with exit code 1.
  exit /b 1
)
node dist\cli.js check demo\repository\real-lifecycle --registry data\registry.json
if not errorlevel 1 (
  echo Expected real lifecycle sample to fail with exit code 1.
  exit /b 1
)
node dist\cli.js plan demo\repository\migration-breaks-tool-use --registry demo\registry.fixture.json --output demo\migration-plan.json
if errorlevel 1 exit /b 1
node dist\cli.js verify --plan demo\migration-plan.json --registry demo\registry.fixture.json --command "node ../../evals/run.mjs migration-breaks-tool-use" --output demo\evidence.json --format json
if not errorlevel 1 (
  echo Expected the synthetic migration eval to fail with exit code 1.
  exit /b 1
)
echo All demo expectations matched. The retired lifecycle and eval failures above are intentional.
exit /b 0
