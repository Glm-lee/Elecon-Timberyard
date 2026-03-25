# Railway Deployment Fix - Elecon Timberyard

## Steps:
1. [x] Create this TODO.md
2. [x] Edit backend/requirements.txt - Add uvicorn[standard]
3. [ ] Install Railway CLI: npm i -g @railway/cli
4. [ ] railway login
5. [ ] railway link [your elecon backend project ID]
6. [ ] cd backend && railway service init (service: backend, root: . )
7. [ ] cd ../frontend && railway service init (service: frontend, root: .)
8. [ ] Set env vars in dashboard: DATABASE_URL, OPENAI_API_KEY etc.
9. [ ] railway up --service backend
10. [ ] railway up --service frontend
11. [ ] Update frontend env NEXT_PUBLIC_API_URL=[backend.railway.app]
12. [ ] Test deployment

Updated: Step 2 complete after edit.

