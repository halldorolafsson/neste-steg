# TODO før flytting til sky

Detaljert, nummerert gjennomføringsplan for Google Cloud finnes i [GOOGLE_CLOUD_FLYTTEPLAN.md](GOOGLE_CLOUD_FLYTTEPLAN.md).

Denne listen dekker anbefalte tiltak før `neste-steg` flyttes til Google Cloud eller en annen skyleverandør. Prioriteringene er skrevet ut fra dagens løsning: Next.js, NextAuth Credentials, Prisma, lokal SQLite i utvikling og planlagt PostgreSQL i produksjon.

## Må gjøres før produksjon

- [ ] Bruk PostgreSQL i sky, ikke SQLite-filen `prisma/dev.db`.
  - Anbefalt for Google Cloud: Cloud Run + Cloud SQL for PostgreSQL.
  - Tilsvarende hos andre leverandører: managed PostgreSQL.

- [ ] Flytt secrets ut av `.env` og inn i leverandørens secret-løsning.
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `OPENAI_API_KEY`
  - For Google Cloud: Secret Manager.
  - Bruk en eksplisitt secret-versjon i Cloud Run i stedet for `latest`.

- [ ] Roter OpenAI API-nøkkelen som tidligere ble delt i chatten.
  - Oppdater lokal `.env` og Secret Manager med den nye nøkkelen.
  - Tilbakekall den gamle nøkkelen i OpenAI Platform før produksjonssetting.

- [ ] Generer en sterk `NEXTAUTH_SECRET` for produksjon.
  - Ikke bruk verdien fra `.env.example`.
  - Hemmeligheten må være stabil mellom deploys, ellers ugyldiggjøres sessions.

- [ ] Sett korrekt produksjonsverdi for `NEXTAUTH_URL`.
  - Eksempel: `https://app.dittdomene.no`
  - Må matche faktisk offentlig URL.

- [ ] Ikke kjør produksjon med seed-brukeren i `prisma/seed.ts`.
  - Dagens seed oppretter `admin@nestesteg.no` med passord `admin123`.
  - Dette må fjernes, endres eller begrenses til lokal utvikling.

- [ ] Legg `prisma/dev.db` i `.gitignore`.
  - Filen kan inneholde brukerdata og passord-hasher.
  - Den er ekskludert fra Docker-build via `.dockerignore`, men bør også ekskluderes fra Git.

- [ ] Sett opp database-migreringer for produksjon.
  - Ikke baser produksjon på `prisma db push`.
  - Bruk migrasjoner og en kontrollert deploy-prosess.

- [ ] Fjern schema-bytte med `sed` i Dockerfile.
  - Dockerfile endrer nå Prisma fra SQLite til PostgreSQL under build.
  - Det er skjørt. Bruk heller en tydelig produksjonsschema-strategi eller gjør schemaet database-uavhengig nok til at deploy ikke patcher filer.

- [ ] Sikre at containeren starter riktig i Cloud Run eller tilsvarende.
  - Appen må lytte på porten fra `PORT`.
  - Nåværende Dockerfile setter `PORT=8080` og `HOSTNAME=0.0.0.0`, som passer Cloud Run.

## Auth og brukersikkerhet

- [ ] Bestem om registrering skal være åpen.
  - Hvis appen er privat: slå av åpen registrering eller bruk invitasjonskode.
  - Hvis appen er offentlig: legg inn misbruksbeskyttelse før lansering.

- [ ] Legg inn rate limiting på login og registrering.
  - Beskytter mot brute force og automatisert kontooppretting.

- [ ] Øk passordkravet.
  - Dagens minimum er 6 tegn.
  - Anbefalt: minst 12 tegn, eventuelt passphrase-vennlig validering.

- [ ] Legg til passord-reset før appen brukes av andre enn eier/testbrukere.

- [ ] Vurder e-postverifisering.
  - Viktig hvis flere brukere skal kunne registrere seg selv.

- [ ] Vurder MFA eller passkey/OAuth hvis appen skal eksponeres offentlig.
  - Alternativ: bruk Google Identity-Aware Proxy, Cloudflare Access eller tilsvarende foran appen hvis den primært er privat.

- [ ] Gjennomgå NextAuth-cookie/oppsett i produksjon.
  - Verifiser HTTPS.
  - Verifiser korrekt domene.
  - Verifiser at sessions fungerer etter redeploy.

## Datamodell og tilgangskontroll

- [ ] Avklar om appen skal være enbruker, privat flerbruker eller offentlig flerbruker.
  - Dette påvirker `Area`, admin-funksjoner og registrering.

- [ ] Gjør `Area` per bruker hvis flere uavhengige brukere skal bruke appen.
  - `Area` er global i dagens schema.
  - En innlogget bruker kan i praksis påvirke områder som gjelder alle.

- [ ] Legg strengere tilgangskontroll på area-actions.
  - `createArea`, `updateArea` og `deleteArea` krever innlogging, men ikke eierskap/rolle.
  - Hvis `Area` forblir global, bør bare admin kunne endre den.

- [ ] Fortsett å filtrere alle brukerdata på `session.user.id`.
  - Dette er allerede gjort mange steder for tasks, assets, focus sessions og weekly reviews.
  - Nye spørringer må følge samme mønster.

- [ ] Vurder global middleware for beskyttede ruter.
  - I dag må hver side/action huske `requireAuth()`.
  - Middleware kan redusere risikoen for at nye sider blir stående åpne.

## Infrastruktur og drift

- [ ] Produksjonstest OpenAI Realtime over WebRTC.
  - Verifiser mikrofon, lydavspilling, avbrytelser og verktøykall på mobil og PC.
  - Verifiser utgående HTTPS/WebRTC-trafikk fra valgt plattform og nettverkspolicy.

- [x] Legg lokal rate limiting per bruker på `/api/realtime/session`.
  - Endepunktet tillater som standard fem sesjonsopprettelser per bruker per minutt.

- [ ] Bruk en delt rate limiter for produksjon og vurder grense per IP.
  - Dagens limiter ligger i minnet til én prosess og deles ikke mellom Cloud Run-instanser.
  - Bruk for eksempel Redis/Memorystore eller ingress/API-gateway.

- [ ] Sett kostnadsgrenser og overvåking for OpenAI Realtime.
  - Logg sesjonsstart og varighet uten å lagre rå lyd eller API-nøkler.
  - Sett varsler og en månedlig forbruksgrense hos OpenAI.
  - Appen avslutter nå samtalen etter fem minutter som standard, men dette er en klientvakt og ikke en serverhåndhevet kostnadsgrense.

- [ ] Dokumenter personvern for taleagenten.
  - Avklar hvilke lyd- og oppgavedata som sendes til OpenAI.
  - Oppdater personverntekst og databehandleroppsett før løsningen brukes av andre.

- [ ] Velg deploy-mål.
  - Google Cloud: Cloud Run + Cloud SQL + Secret Manager.
  - Alternativer: Fly.io, Render, Railway, Azure App Service, AWS App Runner/ECS eller Vercel + hosted PostgreSQL.

- [ ] Sett opp produksjonsdatabase med backup.
  - Aktiver automatiske backups.
  - Test restore-prosessen minst én gang.

- [ ] Sett opp migreringssteg i deploy.
  - Kjør migrasjoner kontrollert før eller under deploy.
  - Unngå at flere instanser kjører migrasjoner samtidig.

- [ ] Sett opp logging og feilrapportering.
  - Minimum: Cloud Logging eller leverandørens standard logging.
  - Gjerne: Error Reporting/Sentry.

- [ ] Sett opp helsecheck eller startup probe hvis deploy-plattformen støtter det.

- [ ] Definer ressursgrenser.
  - Minne
  - CPU
  - Maks antall instanser
  - Concurrency

- [ ] Vurder om tjenesten skal være offentlig tilgjengelig.
  - Privat app: bruk IAP, VPN, Cloudflare Access eller tilsvarende.
  - Offentlig app: vurder WAF/Cloud Armor og rate limiting.

- [ ] Sett opp HTTPS og eget domene.
  - Verifiser at cookies/sessions fungerer på endelig domene.

- [ ] Lag en enkel rollback-plan.
  - Hvordan rulle tilbake container/image?
  - Hvordan håndtere databaseendringer som ikke kan reverseres?

## Kodekvalitet før flytting

- [ ] Få hele `npm run lint` til å passere.
  - Dagens kjøring har én eksisterende feil i `src/components/i18n-provider.tsx` og åtte varsler i eldre kode.

- [ ] Kjør testene og bygg lokalt før deploy.
  - `npm test`
  - `npm run build`

- [ ] Legg inn produksjonstest med PostgreSQL lokalt.
  - Bruk `docker-compose.yml`.
  - Test registrering, innlogging, oppretting av oppgaver og logout mot PostgreSQL.

- [ ] Legg til tester for innlogging/authorize-flow hvis praktisk.
  - Det finnes tester for `registerUser`, men selve NextAuth credentials-flyten er ikke direkte testet.

- [ ] Dokumenter produksjonsoppsett i README eller egen deploy-fil.
  - Miljøvariabler.
  - Database.
  - Migreringer.
  - Seed-regler.
  - Deploy-kommandoer.

## Bør vurderes senere

- [ ] Bytt fra egen passordløsning til ekstern identitet hvis appen får flere brukere.
  - Eksempler: Google OAuth, Auth0, Clerk, Firebase Auth, Entra ID eller passkeys.

- [ ] Legg inn audit-logg for viktige endringer.
  - Login-forsøk.
  - Oppretting/sletting av data.
  - Endringer i globale/admin-styrte data.

- [ ] Krypter særlig sensitive brukerfelt på applikasjonsnivå hvis appen etter hvert lagrer mer sensitiv informasjon.

- [ ] Lag eksport/sletting av brukerdata.
  - Nyttig for personvern, backup og eventuell GDPR-håndtering.

- [ ] Legg inn rollemodell hvis flere brukere skal dele samme installasjon.
  - Admin
  - Vanlig bruker
  - Eventuelt familie/team/workspace senere
