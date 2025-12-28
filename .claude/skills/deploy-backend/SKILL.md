---
name: deploy-backend
description: Deploy compose-engine backend to EC2 server. Use ONLY when user explicitly requests backend deployment. Never modify backend/ folder without explicit permission.
---

# Deploy Backend Skill

Deploy the compose-engine (video rendering backend) to EC2 server.

## CRITICAL RULES

1. **NEVER modify `backend/` folder without explicit user permission**
2. **NEVER auto-deploy** - always wait for explicit request
3. **Always confirm with user before deployment**

## When to Use

- User explicitly says: "deploy backend", "update EC2", "push to server"
- User confirms backend modification is needed
- After testing backend changes locally

## Pre-Deployment Checklist

- [ ] User explicitly requested deployment
- [ ] Code changes tested locally
- [ ] No breaking changes to API contracts
- [ ] Docker image builds successfully

## Deployment Steps

### Step 1: Connect to Server

```bash
ssh hydra-compose
```

### Step 2: Navigate to Project

```bash
cd ~/compose-engine
```

### Step 3: Pull Latest Changes

```bash
git pull origin main
```

### Step 4: Rebuild if Needed (Docker)

```bash
# If Dockerfile or dependencies changed
docker-compose build

# Or for specific service
docker-compose build compose-engine
```

### Step 5: Restart Service

```bash
# Using systemd
sudo systemctl restart compose-engine

# Or using Docker
docker-compose up -d
```

### Step 6: Verify Deployment

```bash
# Check service status
sudo systemctl status compose-engine

# Check Docker containers
docker ps

# Check health endpoint
curl http://localhost:8000/health
```

### Step 7: Monitor Logs

```bash
# Systemd logs
sudo journalctl -u compose-engine -f --since "5 minutes ago"

# Docker logs
docker logs hydra-compose-engine-gpu --tail 100 -f
```

## Docker Commands Reference

```bash
# List running containers
docker ps

# View container logs
docker logs hydra-compose-engine-gpu --tail 100

# Restart container
docker restart hydra-compose-engine-gpu

# Enter container shell
docker exec -it hydra-compose-engine-gpu bash

# View resource usage
docker stats

# Clean up unused images
docker image prune -f
```

## Troubleshooting

### Service Won't Start

```bash
# Check detailed logs
sudo journalctl -u compose-engine -n 100 --no-pager

# Check port conflicts
sudo netstat -tlpn | grep 8000

# Check disk space
df -h
```

### GPU Issues

```bash
# Check NVIDIA driver
nvidia-smi

# Check GPU container access
docker run --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Memory Issues

```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head -10

# Clear Docker cache
docker system prune -a
```

### Network Issues

```bash
# Check if port is accessible
curl http://localhost:8000/health

# Check firewall
sudo ufw status

# Check security group in AWS console
```

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous commit
git log --oneline -5
git checkout <previous-commit-hash>

# Restart service
sudo systemctl restart compose-engine

# Or with Docker
docker-compose down
git checkout <previous-commit-hash>
docker-compose up -d
```

## Server Information

| Item | Value |
|------|-------|
| SSH Alias | `hydra-compose` |
| Project Path | `~/compose-engine` |
| Service Name | `compose-engine` |
| Port | 8000 |
| GPU Container | `hydra-compose-engine-gpu` |

## Environment Variables

Managed via AWS Secrets Manager or `.env` file:

```bash
# View current env (if using .env)
cat ~/compose-engine/.env

# Update secret in AWS
aws secretsmanager update-secret --secret-id hydra/compose-engine ...
```

## Post-Deployment Verification

1. **Health Check**: `curl http://localhost:8000/health`
2. **Test Render**: Submit a test render job
3. **Check Logs**: No errors in last 5 minutes
4. **Monitor Metrics**: CPU/Memory/GPU usage normal
