param(
  [ValidateSet('up', 'down', 'logs', 'restart', 'config')]
  [string]$Action = 'up'
)

$ErrorActionPreference = 'Stop'

$ComposeArgs = @(
  '-f', 'docker-compose.unified.yml',
  '-f', 'docker-compose.preview.yml',
  '-p', 'aikompute-preview'
)

switch ($Action) {
  'up' {
    docker compose @ComposeArgs up -d --build
  }
  'down' {
    docker compose @ComposeArgs down
  }
  'logs' {
    docker compose @ComposeArgs logs -f
  }
  'restart' {
    docker compose @ComposeArgs down
    docker compose @ComposeArgs up -d --build
  }
  'config' {
    docker compose @ComposeArgs config
  }
}
