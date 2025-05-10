#!/bin/bash
# Script to run tests inside the Docker container

# Create a temporary directory in the container
docker exec rsu_postgres_unique_test mkdir -p /tmp/tests

# Copy the test files to the container
docker cp /Users/suwandi/kiwi3/backend/src/routes/__tests__/pool_calculations.integration.test.js rsu_postgres_unique_test:/tmp/tests/
docker cp /Users/suwandi/kiwi3/backend/src/routes/__tests__/decimal_precision.integration.test.js rsu_postgres_unique_test:/tmp/tests/
docker cp /Users/suwandi/kiwi3/backend/src/routes/__tests__/vesting_calculations.integration.test.js rsu_postgres_unique_test:/tmp/tests/

# Install Node.js and necessary packages inside the container
docker exec rsu_postgres_unique_test apt-get update
docker exec rsu_postgres_unique_test apt-get install -y nodejs npm

# Create package.json and install dependencies
docker exec rsu_postgres_unique_test bash -c 'cd /tmp/tests && npm init -y && npm install jest pg'

# Run the tests
docker exec rsu_postgres_unique_test bash -c 'cd /tmp/tests && npx jest pool_calculations.integration.test.js'
