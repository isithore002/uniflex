# UniFlux Production Deployment Guide

## Backend (Render/Railway)

### Environment Variables to Set:
```
UNICHAIN_RPC_URL=https://sepolia.unichain.org
SEPOLIA_RPC_URL=https://sepolia.unichain.org
POOL_MANAGER_ADDRESS=0x00B036B58a818B1BC34d502D3fE730Db729e62AC
TOKEN_A_ADDRESS=0xD49236Bb296e8935dC302De0cccFDf5EC5413157
TOKEN_B_ADDRESS=0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7
SWAP_HELPER_ADDRESS=0x26f814373D575bDC074175A686c3Ff197D4e3b07
LIQUIDITY_HELPER_ADDRESS=0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5
SANDWICH_DETECTOR_ADDRESS=0x3d65a5E73d43B5D20Afe7484eecC5D1364e3dEd6
PRIVATE_KEY=0x668d2c2529b4f67dfb179306923d46000cae3ac6262cbb3ec3b07ea6448830a4
AUTO_MODE=false
AGENT_PORT=3001
```

### Build Configuration:
- **Build Command**: `cd agent && npm install && npm run build`
- **Start Command**: `cd agent && npm start`
- **Root Directory**: `/` (or set working dir to `agent/`)

### Endpoints to Verify:
- GET `https://your-backend.onrender.com/health` → Should return `{"status":"ok"}`
- GET `https://your-backend.onrender.com/status` → Should return agent status
- POST `https://your-backend.onrender.com/autonomous/start` → Starts autonomous mode
- POST `https://your-backend.onrender.com/autonomous/stop` → Stops autonomous mode

---

## Frontend (Vercel)

### Environment Variables to Set:
```
VITE_API_URL=https://your-backend.onrender.com
```

**Important**: Replace `your-backend.onrender.com` with your actual Render URL!

### Build Configuration:
- **Framework Preset**: Vite
- **Root Directory**: `ui`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

## Deployment Checklist

### Backend (Render):
- [ ] All environment variables set
- [ ] Build succeeds (check logs)
- [ ] `/health` endpoint returns 200 OK
- [ ] `/status` endpoint returns JSON
- [ ] CORS allows Vercel domain
- [ ] Wallet has testnet ETH

### Frontend (Vercel):
- [ ] `VITE_API_URL` points to Render backend
- [ ] Build succeeds (no TypeScript errors)
- [ ] Page loads without console errors
- [ ] Browser console shows no CORS errors
- [ ] Status shows "LIVE" (green dot)
- [ ] Run/Stop buttons work

### End-to-End Test:
1. Open Vercel URL: `https://uniflex-buds.vercel.app`
2. Click "run" command → Should see "AUTO #1" in status bar
3. Check Render logs → Should show autonomous cycles running
4. Click "stop" command → Should return to "MANUAL"
5. Test other commands: `status`, `mev`, `simulate-volatility`

---

## Troubleshooting

### Frontend can't connect to backend:
- Check `VITE_API_URL` is set correctly in Vercel
- Check CORS in Render logs
- Test backend URL directly: `curl https://your-backend.onrender.com/health`

### Backend crashes/restarts:
- Check Render logs for errors
- Verify RPC_URL is accessible
- Check wallet private key is valid
- Increase memory if needed (Render: 512MB → 1GB)

### "Manual mode" won't start:
- Check `/autonomous/start` endpoint exists
- Check browser console for fetch errors
- Verify CORS headers in response

---

## Production Best Practices

1. **Environment Variables**: Never commit `.env` - use platform secrets
2. **CORS**: Restrict to specific domains (already configured)
3. **Error Handling**: Backend logs errors, doesn't crash
4. **Memory**: TypeScript compiled (low memory usage)
5. **Monitoring**: Check Render/Vercel dashboards regularly

---

## Demo Mode (For Judges)

To run autonomous mode for demo:
1. Set `AUTO_MODE=true` in Render environment variables
2. Backend auto-starts on deployment
3. UI shows "AUTO #X" immediately
4. Use `simulate-volatility` command to demo MEV detection
