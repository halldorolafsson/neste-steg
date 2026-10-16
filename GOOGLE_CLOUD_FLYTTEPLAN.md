# Flytteplan for Neste steg til Google Cloud

Denne veiledningen beskriver en kontrollert flytting av hele `neste-steg` fra lokal kjøring til Google Cloud.

Planen er tilpasset følgende Google Cloud-prosjekt:

- Visningsnavn oppgitt av eier: `runprice`
- Prosjektnummer: `294460811969`
- Prosjekt-ID: `runprice`, bekreftet i steg 3 den 6. oktober 2026. Visningsnavnet hos Google Cloud er `Runprice`.
- Anbefalt region: `europe-north1` (Finland)

Målarkitekturen er:

- **Cloud Run** for Next.js-applikasjonen
- **Cloud SQL for PostgreSQL** for alle varige data
- **Artifact Registry** for container-images
- **Secret Manager** for databasekobling, NextAuth-hemmelighet og OpenAI-nøkkel
- **Cloud Logging** for applikasjonslogger
- **OpenAI Realtime** for taleagenten, som i dagens løsning

Cloud Run gir en offentlig HTTPS-adresse. HTTPS gjør at mikrofonen kan brukes fra mobil og PC uten Tailscale-sertifikatet som trengs i det lokale oppsettet.

> **Viktig:** Dagens kode er ikke klar for en produksjonsflytting uten forarbeidet i steg 1. Ikke opprett produksjonsdatabasen og flytt brukere før dette steget er ferdig og testet.

## 1. Gjør applikasjonen produksjonsklar

Følgende punkter er reelle blokkere i dagens prosjekt, kontrollert 5. oktober 2026:

1. Ta en urørt sikkerhetskopi av `prisma/dev.db` før databasearbeidet starter.

   ```powershell
   New-Item -ItemType Directory -Force -Path .\backup | Out-Null
   Copy-Item -LiteralPath .\prisma\dev.db `
     -Destination ".\backup\dev-$((Get-Date).ToString('yyyyMMdd-HHmmss')).db"
   ```

   Oppbevar også en kopi utenfor prosjektmappen. Ikke legg sikkerhetskopien i Git.

2. Legg `prisma/dev.db` og `backup/` i `.gitignore`. Databasen kan inneholde personopplysninger og passord-hasher.

3. Gjør PostgreSQL til den eksplisitte produksjonsdatabasen.

   Dagens `Dockerfile` endrer Prisma-provider fra SQLite til PostgreSQL med `sed` under bygging. Det er skjørt og gir ingen PostgreSQL-migreringshistorikk. Anbefalt løsning er å:

   - bruke PostgreSQL som kanonisk provider i produksjon
   - bruke lokal PostgreSQL, for eksempel med Docker Compose, når migrasjoner utvikles og testes
   - fjerne `sed`-endringen fra `Dockerfile`
   - generere og versjonskontrollere en første migrasjon i `prisma/migrations/`
   - bruke `prisma migrate deploy` i skyen, aldri `prisma db push`

4. Lag et kontrollert migrerings-image eller inkluder Prisma CLI i en egen migreringsvariant av imaget.

   Dagens runner-image inneholder Prisma Client, men ikke nok av Prisma CLI til å kjøre `prisma migrate deploy`. Målet er at en Cloud Run Job skal kunne kjøre:

   ```powershell
   npx prisma migrate deploy
   ```

5. Fjern produksjonsrisikoen i `prisma/seed.ts`.

  Fullført lokalt 6. oktober 2026: seed oppretter bare områder, steder og menyinnstillinger. Den oppretter ikke brukere og endrer ikke adminrettigheter. To kjøringer mot en separat testdatabase er kontrollert uten duplikater eller endring av eksisterende brukerdata. Admin-brukeren skal enten overføres fra lokal database eller opprettes av en separat engangsjobb med et sterkt, midlertidig passord. Ikke kjør seed før dataimport uten å avklare ID-konflikter for grunndata.

6. Lag og test et eget eksport/import-program for SQLite til PostgreSQL.

   Det må bevare ID-er og relasjoner. Anbefalt importrekkefølge er:

   1. `User`
   2. `Area`
   3. `Location`
   4. `NavigationSetting`
   5. `Asset`
   6. `Task`
   7. `FocusSession`
   8. `WeeklyReview`

   Eksisterende `hashedPassword` kan overføres uendret, slik at brukerne beholder passordene sine. Importprogrammet må være mulig å kjøre i testmodus og må skrive ut antall eksporterte og importerte rader per tabell.

  Fullført lokalt 6. oktober 2026: `prisma/transfer-data.ts` er testet mot to separate PostgreSQL-databaser fra sikkerhetskopien. Alle felt, ID-er, passord-hasher og relasjoner er kontrollert. Testmodus og feil ruller tilbake hele importen; ikke-tomme målbaser avvises. Fokusøkter og ukesoppsummeringer er også testet med syntetiske data siden disse tabellene er tomme i sikkerhetskopien. Appens lokale database er ikke importert.

  ```powershell
  npm run db:transfer -- export --source backup/dev-20261006-113031.db --output backup/data-export.json
  npm run db:transfer -- import --input backup/data-export.json --dry-run
  npm run db:transfer -- import --input backup/data-export.json --commit
  ```

  Sett `DATABASE_URL` til riktig målbase og kjør migrasjoner først. Alle applikasjonstabeller må være tomme. Eksportfilen inneholder private data og passord-hasher; oppbevar den skjermet og aldri i Git. Kjør ikke seed før import.

7. Sikre registrering og innlogging før URL-en gjøres offentlig.

   - Bestem om selvregistrering skal være slått av eller kreve invitasjon.
   - Øk passordkravet fra dagens minimum på seks tegn.
   - Legg rate limiting på registrering og innlogging.
   - Behold admin-sjekk på administrative innstillinger.

  Implementert lokalt 6. oktober 2026: bare admin kan opprette invitasjoner fra Innstillinger. Lenken deles manuelt, gjelder én e-postadresse i 48 timer og kan brukes én gang eller trekkes tilbake. Bare tokenhash lagres i databasen. Nye brukere får ikke adminrettigheter. Nye passord krever minst 12 tegn og maksimalt 72 UTF-8-byte; eksisterende passord beholdes ved innlogging. Invitasjonsflyten er nettlesertestet med separate testbrukere.

  Innlogging begrenses til 10 forsøk per e-postadresse per 15 minutter og 100 forsøk totalt per minutt. Registrering begrenses til 5 forsøk per token og 20 totalt per 15 minutter. Disse grensene ligger i prosessminnet og krever fortsatt maksimalt én Cloud Run-instans; prosessomstart nullstiller dem. Invitasjonstabellen opprettes av migrasjonen `20261006134000_user_invitations`. Eksisterende admin overføres med dataimporten; ingen standardadmin opprettes.

8. Behold maksimalt én Cloud Run-instans ved første produksjonssetting.

  Klargjort lokalt 6. oktober 2026: kommandoene i steg 16 og 17 bruker `--max=1`, som begrenser hele tjenesten, ikke bare én revisjon slik `--max-instances=1` gjør. Grensen må bekreftes i Cloud Run etter deploy; ingen skyressurser er opprettet i dette steget.

  Rate limiterne for innlogging, registrering og OpenAI Realtime ligger i prosessminnet. Cloud Run kan kortvarig overskride instansgrensen, og omstart nullstiller tellerne. Grensen er derfor en begrensning av skalering, ikke en garanti for globale rate limits. Før løsningen skaleres til flere instanser, eller trenger strenge globale grenser, må limiterne flyttes til en delt tjeneste, for eksempel Redis/Memorystore.

**Godkjenningspunkt:** Fortsett først når PostgreSQL-migrasjoner, migreringsjobben og eksport/import-programmet har vært testet mot en tom lokal PostgreSQL-database.

## 2. Bestem tilgangsmodell og region

Godkjent av eier 6. oktober 2026: `europe-north1` (Finland) for Cloud Run, Cloud SQL og Artifact Registry. Cloud Run får et offentlig HTTPS-endepunkt, men applikasjonens data krever NextAuth-innlogging. Nye brukere må inviteres av admin; åpen selvregistrering er stengt. Tjenesten konfigureres med `--max=1`, med begrensningene beskrevet i steg 1.8. Ingen skyressurser er opprettet som del av denne beslutningen.

1. Bruk `europe-north1` for Cloud Run, Cloud SQL og Artifact Registry. Samme region gir enklere oppsett og unngår unødvendig trafikk mellom regioner.

2. For en privat eller liten installasjon anbefales i første omgang:

   - Cloud Run-endepunktet er offentlig tilgjengelig med `--allow-unauthenticated`.
   - Selve appen beskytter data med NextAuth-innlogging.
   - Åpen selvregistrering er deaktivert før produksjonssetting.
   - Cloud Run begrenses til én instans.

   `--allow-unauthenticated` betyr bare at nettleseren får nå Cloud Run. Det omgår ikke applikasjonens innlogging. Hvis løsningen senere skal være strengt intern, bør Identity-Aware Proxy eller en tilsvarende tilgangsproxy vurderes.

3. Start med en zonal Cloud SQL-instans for lavere kostnad. Velg regional høy tilgjengelighet hvis nedetid ikke kan aksepteres. Dette omtrent dobler databaseinfrastrukturen og kostnaden.

## 3. Installer Google Cloud CLI og velg riktig prosjekt

Fullført 6. oktober 2026: eksisterende Google Cloud SDK 587.0.0 er kontrollert og en konto er allerede innlogget. Prosjekt `runprice` er bekreftet med prosjektnummer `294460811969`, visningsnavn `Runprice` og status `ACTIVE`. Fakturering er aktivert (`billingEnabled: True`), og prosjektet er valgt i CLI-en. Ingen API-er eller skyressurser er opprettet i dette steget.

CLI-en ligger i `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin`, men var ikke i denne terminalens `PATH`. For nye PowerShell-vinduer ved behov:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH
```

Ved oppsett på en annen PC: installer [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), eller bruk Cloud Shell i Google Cloud-konsollen. Kommandoene nedenfor er skrevet for PowerShell. Innlogging trenger ikke gjentas når riktig konto allerede er aktiv.

1. Logg inn:

   ```powershell
   gcloud auth login
   ```

2. Slå opp den uforanderlige prosjekt-ID-en fra prosjektnummeret:

   ```powershell
   $PROJECT_NUMBER = "294460811969"
   $PROJECT_ID = gcloud projects describe $PROJECT_NUMBER --format="value(projectId)"

   gcloud projects describe $PROJECT_NUMBER `
     --format="table(projectId,name,projectNumber,lifecycleState)"
   ```

3. Kontroller at resultatet viser prosjektet du kjenner som `runprice`, og sett det som aktivt:

   ```powershell
   if (-not $PROJECT_ID) { throw "Fant ikke prosjekt-ID for $PROJECT_NUMBER" }

   gcloud config set project $PROJECT_ID
   gcloud auth list
   gcloud config list
   ```

4. Kontroller at billing er koblet til prosjektet:

   ```powershell
   gcloud billing projects describe $PROJECT_ID
   ```

   Ikke fortsett hvis `billingEnabled` ikke er `True`.

## 4. Definer navn som brukes videre

Fullført 6. oktober 2026: navnene nedenfor er satt i den aktive PowerShell-økten med prosjekt-ID `runprice`, og Cloud Run-standardregionen er satt til `europe-north1`. Ingen skyressurser er opprettet. PowerShell-variablene må settes på nytt hvis terminaløkten avsluttes; regionen er lagret i den aktive gcloud-konfigurasjonen.

Kjør dette i samme PowerShell-vindu som resten av oppsettet:

```powershell
$REGION = "europe-north1"
$SERVICE = "neste-steg"
$AR_REPO = "neste-steg"
$SQL_INSTANCE = "neste-steg-db"
$DB_NAME = "nestesteg"
$DB_USER = "nestesteg_app"
$SA_NAME = "neste-steg-run"
$RUN_SA = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
$MIGRATION_JOB = "neste-steg-migrate"

gcloud config set run/region $REGION
```

## 5. Aktiver nødvendige API-er

Fullført 6. oktober 2026 i prosjekt `runprice`: alle sju API-ene nedenfor er aktivert og kontrollert med `gcloud services list --enabled`. Ingen database, containerlager eller Cloud Run-tjeneste er opprettet i dette steget.

```powershell
gcloud services enable `
  run.googleapis.com `
  sqladmin.googleapis.com `
  secretmanager.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  iam.googleapis.com `
  logging.googleapis.com
```

Vent til kommandoen er ferdig før neste steg.

## 6. Opprett Artifact Registry

Fullført 6. oktober 2026: Docker-lageret `neste-steg` er opprettet i prosjekt `runprice`, region `europe-north1`, og kontrollert med `gcloud artifacts repositories describe`. Lageradressen er `europe-north1-docker.pkg.dev/runprice/neste-steg`. Lageret er foreløpig tomt; ingen container-images er bygget eller lastet opp i dette steget.

```powershell
gcloud artifacts repositories create $AR_REPO `
  --repository-format=docker `
  --location=$REGION `
  --description="Container-images for Neste steg"
```

Kontroller resultatet:

```powershell
gcloud artifacts repositories describe $AR_REPO --location=$REGION
```

Artifact Registry skal ligge i samme region som Cloud Run.

## 7. Opprett en egen runtime-servicekonto

Fullført 6. oktober 2026: `neste-steg-run@runprice.iam.gserviceaccount.com` er opprettet og kontrollert. Kontoen har bare `roles/cloudsql.client` blant direkte prosjektroller, verifisert med prosjektets IAM-policy. Ingen tjenestekontonøkkel er opprettet. Tilgang til de konkrete hemmelighetene tildeles senere; Cloud SQL-instansen er ikke opprettet i dette steget.

Ikke bruk din personlige Google-konto eller en bred standardkonto som applikasjonens identitet.

```powershell
gcloud iam service-accounts create $SA_NAME `
  --display-name="Neste steg Cloud Run runtime"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$RUN_SA" `
  --role="roles/cloudsql.client"
```

Runtime-kontoen skal bare få tilgang til Cloud SQL og de tre konkrete hemmelighetene som opprettes senere. Den trenger ikke eier-, editor- eller build-rettigheter.

## 8. Opprett Cloud SQL for PostgreSQL

Fullført 6. oktober 2026: `neste-steg-db` er opprettet og verifisert i `runprice`, region `europe-north1` (sone `europe-north1-a`), med PostgreSQL 16 Enterprise, `db-f1-micro`, 10 GB SSD og automatisk lagringsvekst. Instansen er `RUNNABLE`. Daglig backup kl. 02:00 UTC, PITR med sju dagers transaksjonslogger og slettingsbeskyttelse er aktivert og kontrollert.

Databasen `nestesteg` og appbrukeren `nestesteg_app` er opprettet. Tilkoblingsnavnet er `runprice:europe-north1:neste-steg-db`. Instansen har offentlig IP for Cloud SQL-koblingen, men ingen autoriserte eksterne nettverk for direkte tilgang. Bruk Cloud SQL-koblingen eller Auth Proxy, ikke åpne PostgreSQL-porten for internett.

Et tilfeldig databasepassord er generert og ligger bare i `$DB_PASSWORD` i den aktive terminaløkten; det er ikke skrevet ut eller lagret i fil. Behold økten til passordet er lagret i Secret Manager i et senere steg. Hvis økten går tapt, må passordet tilbakestilles før resten av oppsettet. Ingen Prisma-migrasjoner eller appdata er overført til Cloud SQL ennå. Instansen har løpende kostnader og er uten høy tilgjengelighet.

Følgende oppsett er egnet for første produksjonsversjon med lav trafikk. `db-f1-micro` er rimelig, men har begrensede ressurser og ingen høytilgjengelighets-SLA.

```powershell
gcloud sql instances create $SQL_INSTANCE `
  --database-version=POSTGRES_16 `
  --edition=ENTERPRISE `
  --tier=db-f1-micro `
  --region=$REGION `
  --availability-type=zonal `
  --storage-type=SSD `
  --storage-size=10 `
  --storage-auto-increase `
  --backup-start-time=02:00 `
  --enable-point-in-time-recovery `
  --retained-transaction-log-days=7 `
  --deletion-protection
```

Opprett database og en egen applikasjonsbruker:

```powershell
$DB_PASSWORD = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))"

gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE
gcloud sql users create $DB_USER `
  --instance=$SQL_INSTANCE `
  --password=$DB_PASSWORD

$CONNECTION_NAME = gcloud sql instances describe $SQL_INSTANCE `
  --format="value(connectionName)"

Write-Host "Cloud SQL connection name: $CONNECTION_NAME"
```

Ikke skriv `$DB_PASSWORD` til en vanlig tekstfil. PowerShell-historikken lagrer kommandoen med variabelnavnet, ikke verdien som variabelen inneholder.

Kontroller backup og PITR:

```powershell
gcloud sql instances describe $SQL_INSTANCE `
  --format="yaml(connectionName,region,databaseVersion,settings.tier,settings.backupConfiguration)"
```

Hvis backup eller PITR ikke er aktivt, kjør:

```powershell
gcloud sql instances patch $SQL_INSTANCE --backup-start-time=02:00
gcloud sql instances patch $SQL_INSTANCE --enable-point-in-time-recovery
```

## 9. Bygg databasekoblingen for Cloud Run

Fullført 6. oktober 2026: Cloud Run-koblingen er bygget i `$DATABASE_URL` i den aktive PowerShell-økten. Formatet er kontrollert med URI-parser: appbruker `nestesteg_app`, database `nestesteg`, port 5432 og socket `/cloudsql/runprice:europe-north1:neste-steg-db`. Passordet og hele koblingsstrengen er ikke skrevet ut eller lagret i fil. Lokal `.env` er uendret. Dette er en formatkontroll, ikke en test av databasetilkoblingen; koblingen er ennå ikke lagret i Secret Manager eller brukt av Cloud Run. Behold terminaløkten til hemmeligheten er lagret i steg 11.

Cloud Run kobler til Cloud SQL gjennom en kryptert Unix socket på `/cloudsql/PROJECT:REGION:INSTANCE`. Dagens `pg`-adapter kan lese socket-stien fra `host` i tilkoblings-URL-en.

```powershell
$ENCODED_PASSWORD = [System.Uri]::EscapeDataString($DB_PASSWORD)
$SOCKET_PATH = "/cloudsql/$CONNECTION_NAME"
$ENCODED_SOCKET = [System.Uri]::EscapeDataString($SOCKET_PATH)

$DATABASE_URL = "postgresql://${DB_USER}:${ENCODED_PASSWORD}@localhost:5432/${DB_NAME}?host=${ENCODED_SOCKET}"
```

Ikke skriv ut `$DATABASE_URL`; den inneholder databasepassordet.

## 10. Roter OpenAI-nøkkelen

Bekreftet utført av eier 6. oktober 2026. Den nye nøkkelen er ikke delt i chatten. Rotasjonen og forbruksinnstillingene er ikke kontrollert via OpenAI API.

En OpenAI API-nøkkel ble tidligere delt i en chat. Før produksjonssetting må den nøkkelen tilbakekalles og erstattes:

1. Åpne OpenAI Platform og opprett en ny prosjektbegrenset API-nøkkel.
2. Tilbakekall den tidligere delte nøkkelen.
3. Sett forbruksvarsler og en hard forbruksgrense der det er tilgjengelig.
4. Bruk bare den nye nøkkelen i Secret Manager.

API-nøkkelen skal aldri ligge i Git, Docker-imaget, en klientkomponent eller en vanlig Cloud Run-miljøvariabel.

## 11. Opprett hemmeligheter i Secret Manager

Fullført 6. oktober 2026 i prosjekt `runprice`: alle tre hemmeligheter er opprettet med automatisk replikering og har verifisert aktivert versjon `1`. `database-url` og `nextauth-secret` ble lagret via standard input uten midlertidige filer. Eier la den nye OpenAI-nøkkelen direkte inn i Google Cloud-konsollen etter at terminalforsøket ikke lyktes; verdien ble ikke delt i chatten. Runtime-kontoens `roles/secretmanager.secretAccessor` er verifisert på hver av de tre konkrete hemmelighetene, ikke tildelt på prosjektnivå. `$DB_SECRET_VERSION`, `$AUTH_SECRET_VERSION` og `$OPENAI_SECRET_VERSION` er satt til de verifiserte versjonsnumrene i den aktive terminaløkten. Kontrollene leste bare versjonsmetadata og IAM-policy, ikke hemmelighetsinnhold; OpenAI-nøkkelens funksjon testes senere.

Opprett tre hemmeligheter:

- `database-url`
- `nextauth-secret`
- `openai-api-key`

Følgende PowerShell-funksjon sender verdien direkte fra minnet til CLI-ens standard input, uten midlertidig fil eller linjeskift. Bare versjonsnummeret returneres. Opprett navnene først; ikke kjør opprettingen på nytt hvis de allerede finnes:

```powershell
gcloud secrets create database-url --replication-policy=automatic --project=$PROJECT_ID
gcloud secrets create nextauth-secret --replication-policy=automatic --project=$PROJECT_ID
gcloud secrets create openai-api-key --replication-policy=automatic --project=$PROJECT_ID

function Add-SecretVersion {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("database-url", "nextauth-secret", "openai-api-key")][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $cliPath = (Get-Command gcloud.cmd -ErrorAction Stop).Source
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $env:ComSpec
  $startInfo.Arguments = "/d /s /c `"`"$cliPath`" secrets versions add $Name --data-file=- --project=$PROJECT_ID --format=value(name) --quiet`""
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    [void]$process.Start()
    $process.StandardInput.Write($Value)
    $process.StandardInput.Close()
    $output = $process.StandardOutput.ReadToEnd()
    $null = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      throw "Secret version upload failed for $Name."
    }
    if ($output.Trim() -notmatch '/versions/([0-9]+)$') {
      throw "Could not verify uploaded version for $Name."
    }
    return $Matches[1]
  }
  finally {
    $process.Dispose()
  }
}

$NEXTAUTH_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"

$DB_SECRET_VERSION = Add-SecretVersion -Name "database-url" -Value $DATABASE_URL
$AUTH_SECRET_VERSION = Add-SecretVersion -Name "nextauth-secret" -Value $NEXTAUTH_SECRET
```

Les den **nye** OpenAI-nøkkelen direkte i terminalen med skjult input. Ikke send verdien gjennom chat eller assistentverktøy. Verdien lagres ikke i PowerShell-historikken:

Alternativt kan eier velge **Ny versjon** på `openai-api-key` i Google Cloud-konsollen og lime inn nøkkelen der. Terminalvarianten nedenfor krever samme PowerShell-økt som funksjonen `Add-SecretVersion`; den er ikke automatisk tilgjengelig i andre terminaler.

```powershell
$secureKey = Read-Host "Lim inn den nye OpenAI API-nøkkelen" -AsSecureString
$keyPointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $OPENAI_API_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $OPENAI_SECRET_VERSION = Add-SecretVersion -Name "openai-api-key" -Value $OPENAI_API_KEY
}
finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  $secureKey.Dispose()
  Remove-Variable OPENAI_API_KEY, secureKey, keyPointer -ErrorAction SilentlyContinue
}
```

Gi runtime-kontoen lesetilgang til bare disse hemmelighetene:

```powershell
"database-url", "nextauth-secret", "openai-api-key" | ForEach-Object {
  gcloud secrets add-iam-policy-binding $_ `
    --member="serviceAccount:$RUN_SA" `
    --role="roles/secretmanager.secretAccessor" `
    --project=$PROJECT_ID `
    --condition=None `
    --quiet `
    --format=none
}
```

Finn og noter den nyeste aktiverte versjonen av hver hemmelighet:

```powershell
gcloud secrets versions list database-url --filter="state=ENABLED"
gcloud secrets versions list nextauth-secret --filter="state=ENABLED"
gcloud secrets versions list openai-api-key --filter="state=ENABLED"
```

Opplastingsfunksjonen setter de faktiske versjonsnumrene i `$DB_SECRET_VERSION`, `$AUTH_SECRET_VERSION` og `$OPENAI_SECRET_VERSION`. Kontroller at disse stemmer med de aktiverte versjonene ovenfor; ikke anta at nummeret er `1` ved senere oppdateringer.

Bruk eksplisitte versjonsnumre ved deploy, ikke `latest`. Da er det mulig å vite nøyaktig hvilke verdier en Cloud Run-revisjon bruker og å rulle kontrollert tilbake.

## 12. Kjør full lokal kvalitetskontroll

Påbegynt 6. oktober 2026, men ikke godkjent for videre produksjonssetting: `npm ci`, Prisma-klientgenerering, lint og produksjonsbygg bestod. Første standard testkjøring fikk én tidsgrensefeil i eksporttesten (fem sekunder); testen bestod isolert, og alle 116 tester bestod med `npm test -- --maxWorkers=2`, uten kodeendring.

Første `npm audit --omit=dev` rapporterte 37 varsler i produksjonsavhengighetene: fem kritiske, 20 høye, ni moderate og tre lave. Kritiske pakkevarsler omfattet blant annet `next`, `next-auth` og autentiseringsavhengigheter. Dette er audit-funn, ikke en bekreftelse på utnyttbarhet i denne appen, men de må vurderes og håndteres før produksjonssetting. Foreslåtte automatiske rettinger omfatter også nedgraderinger og andre potensielt inkompatible endringer; `npm audit fix --force` er ikke brukt.

De øvrige lokale brukerflytene nedenfor er ikke gjennomført på nytt i dette steget; invitasjonsflyten ble testet i steg 1.7. Steg 12 er blokkert inntil sikkerhetsfunnene er avklart og nødvendig ny kvalitetskontroll og brukerflyt-testing er fullført. Ingen container-images er bygget i skyen eller deployet.

Kontrollerte oppgraderinger godkjent av eier og gjennomført 6. oktober 2026: Next.js og `eslint-config-next` er oppgradert til 16.3.8, NextAuth er oppgradert til 4.24.15, og den ubrukte `@auth/prisma-adapter` er fjernet. De 16 autentiseringstestene og produksjonsbygget bestod. Produksjonsaudit er redusert til 31 varsler (tre kritiske, 17 høye, åtte moderate og tre lave); Next.js-varslene er borte, men blant annet en valgfri `@auth/core`-peer og `proxy-addr` gjenstår.

Neste pakkeendring ble blokkert av intern npm-feil `Cannot read properties of null (reading 'edgesOut')` i npm 8.3.0, som kjøres via en gammel global installasjon med Node 24.14.0. To overstyringsvarianter og forsøk på nyere npm via `npx` feilet i den gamle resolveren. Uvaliderte endringer (Auth.js-overstyring, flytting av verktøy og Vitest-oppgradering) er trukket tilbake; manifest og låsefil er kontrollert konsistente, og de 16 autentiseringstestene bestod igjen. Den første validerte oppgraderingen er beholdt. Installeringsverktøyet må avklares før resten av oppgraderingene; steg 12 er fortsatt blokkert.

Senere kontroll 6. oktober 2026: npm-blokkeringen er løst ved å kjøre `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"` direkte (npm 11.9.0), uten global endring. Prisma-CLI og shadcn er flyttet til utviklingsavhengigheter, Vitest er oppgradert til 4.1.11, og kompatible transitive pakker er oppdatert. Fire eksplisitte sikkerhetsoverstyringer er brukt: `@auth/core` 0.41.3, `@hono/node-server` 1.19.15, `mysql2` 3.24.0 og `valibot` 1.4.2. Prisma 7.8.0 er beholdt. Ren installasjon, Prisma-generering, lint, alle 120 tester med to workers og produksjonsbygg bestod.

Docker-kontrollen avdekket databaseinitiering ved modulimport, som er rettet med lat klientinitiering og fire regresjonstester. Runner- og migreringsimaget er bygget lokalt. Runner bygger uten databasehemmeligheter og har verifisert Prisma Client uten Prisma CLI, `@prisma/config` eller `deepmerge-ts`; den tidligere kopieringen av hele `@prisma` er fjernet. Migreringsimaget kjørte begge migrasjoner mot en separat lokal PostgreSQL-database. Ingen skybygg er kjørt i dette steget.

Residual sikkerhetsrisiko: full audit rapporterer 12 varsler (11 høye, ett lavt), ingen kritiske. Produksjonsaudit rapporterer tre høye varsler fra én `deepmerge-ts`-feil gjennom Prisma CLI/config. Disse pakkene er verifisert ute av runner, men finnes i bygge- og migreringsverktøyene. Prisma-konfigurasjonen er et statisk objekt, ikke en rekursiv graf fra brukerinput. Dette er en vurdering av eksponering, ikke en retting av upstream-feilen eller en ren audit. Øvrige utviklingsverktøyvarsler må også følges opp; bruk bare gjennomgått konfigurasjon og isolerte bygge- og migreringsmiljøer. Ingen major-nedgradering eller `audit fix --force` er brukt.

Nettleserkontroll mot det bygde runner-imaget og kun testdata bestod for innlogging/utlogging, invitasjon og registrering av vanlig bruker, skjuling av invitasjonsadministrasjon, engangslenke og blokkert åpen registrering, oppgaveoppretting/redigering/sletting, oppretting av område og sted, eiendel med områdetilknytning og lagring/visning av menyvalg. Mobilkontroll hadde ingen horisontal overflow. Testcontainer og separat testdatabase er stoppet og slettet. Appens vanlige lokale database og skydata er uendret.

Steg 12 er fullført. Eier bekreftet 6. oktober 2026 at den manuelle taletesten gikk glimrende, og aksepterte deretter eksplisitt den dokumenterte rest-risikoen fra verktøyavhengighetene med videre oppfølging. Aksepten gjelder de beskrevne 12 audit-varslene og eksponeringen i bygge-/migreringsverktøyene; den betyr ikke at sårbarhetene er rettet eller at audit er ren. Følg opp upstream-rettinger og vurder avhengigheter og overrides på nytt ved senere oppgraderinger. Steg 13 krever separat godkjenning; skybygg er ikke startet.

Manuell taletest ble klargjort etter eiers godkjenning 6. oktober 2026: separat lokal database `voice_test_20261006163612` og container `neste-steg-voice-test` på `http://localhost:3102`, med kun testdata og en vanlig testbruker. Den nye nøkkelen ble hentet direkte fra Secret Manager til containerens prosessmiljø, uten å vises, sendes som kommandolinjeverdi eller lagres i lokal fil. Uautentisert sesjonsforespørsel ble avvist med HTTP 401. Testbrukerens sesjonsforespørsel svarte HTTP 200 med kortlivet nøkkel for `gpt-realtime-2.1` og 90 sekunders grense. Nøkkelverdiene ble ikke vist. Eier bekreftet deretter at taletesten bestod; dette er en manuell bekreftelse, ikke en automatisert lydtest. Testcontaineren er stoppet og fjernet, og testdatabasen er slettet. Vanlig lokal database og skydata er uendret.

Før imaget bygges i skyen:

```powershell
npm ci
npm run lint
npm test
npm run build
```

Alle fire kommandoene skal fullføre uten feil. Test også lokalt mot PostgreSQL:

1. Registrering eller kontrollert oppretting av bruker
2. Innlogging og utlogging
3. Oppretting, redigering og sletting av oppgaver
4. Områder, steder og eiendeler
5. Adminstyrt visning av menypunkter
6. Taleagentens oppretting av oppgaveutkast

## 13. Bygg container-imaget i Cloud Build

Status 6. oktober 2026: godkjent av eier og fullført. Begge Cloud Build-bygg i `europe-north1` bestod, og begge imagene er publisert og verifisert i Artifact Registry med tag `20261006-172735`.

- App: `europe-north1-docker.pkg.dev/runprice/neste-steg/neste-steg:20261006-172735`, bygge-ID `5d70dcc4-b99a-4231-a2ae-6d447f763620`, digest `sha256:cc0d5ce87a1112ddee4de85d92fb7f79280ad9b978b0bc31db97d5423599df4b`.
- Migrering: `europe-north1-docker.pkg.dev/runprice/neste-steg/neste-steg-migration:20261006-172735`, bygge-ID `8c059545-5924-4e6a-9bcd-6f3111e068a7`, digest `sha256:5762f64462950cc5975158945e7b7d03bf69e9e01cf583efcdfe8fa2d2ef1555`.

Kildeopplastingen ble kontrollert med `gcloud meta list-files-for-upload` før innsending: 92 filer, uten `.env*`, SQLite-database, backup, privat `Importfil.json`, `node_modules` eller `.next`. Ny `.gcloudignore` inkluderer `.dockerignore`; importfilen er ekskludert fra begge kontekster. Ingen app er deployet, ingen databasemigrering er kjørt i skyen, og ingen brukerdata er importert. Steg 14 krever separat godkjenning.

Kjør fra `C:\dev\neste-steg`:

```powershell
$TAG = Get-Date -Format "yyyyMMdd-HHmmss"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/${SERVICE}:$TAG"

gcloud builds submit --project=$PROJECT_ID --region=$REGION --tag=$IMAGE .
```

Bruk alltid en unik tag. Ikke baser produksjonsdeploy på en flyttbar `latest`-tag.

Kontroller imaget:

```powershell
gcloud artifacts docker images describe $IMAGE
```

Bygg og publiser ogsa det separate migrerings-imaget med samme tag:

```powershell
$MIGRATION_IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/${SERVICE}-migration:$TAG"
gcloud builds submit --project=$PROJECT_ID --region=$REGION --config=cloudbuild.migration.yaml `
  --substitutions="_MIGRATION_IMAGE=$MIGRATION_IMAGE" .
gcloud artifacts docker images describe $MIGRATION_IMAGE
```

`.dockerignore` ekskluderer allerede `.env*`, `prisma/dev.db`, dokumentasjon, tester og lokale byggemapper fra imaget.

## 14. Opprett og kjør migreringsjobben

Status: eier godkjente steg 14 og videre dataimport og igangsetting samlet. Eksekvering `neste-steg-migrate-dr6r5` bestod med fast migreringsdigest, runtime-konto, Cloud SQL-tilkobling og `database-url:1`. Begge Prisma-migreringene er fullført i skyen.

Dette steget forutsetter at blokkeren i steg 1 er løst, slik at imaget har migreringsfiler og kan kjøre Prisma CLI.

```powershell
gcloud run jobs deploy $MIGRATION_JOB `
  --image=$MIGRATION_IMAGE `
  --region=$REGION `
  --service-account=$RUN_SA `
  --set-cloudsql-instances=$CONNECTION_NAME `
  --set-secrets="DATABASE_URL=database-url:$DB_SECRET_VERSION" `
  --command=npx `
  --args=prisma,migrate,deploy `
  --tasks=1 `
  --parallelism=1 `
  --max-retries=0 `
  --task-timeout=10m

gcloud run jobs execute $MIGRATION_JOB `
  --region=$REGION `
  --wait
```

Jobben må fullføre med status `Succeeded`. Ikke la hver Cloud Run-instans kjøre migrering ved oppstart; flere instanser kan ellers konkurrere om samme schemaendring.

## 15. Prøveimporter lokale data

Status: fersk kopi `backup/dev-final-20261006-174215.db` og eksport `backup/transfer-final-20261006-174215.json` er integritetskontrollert. To skyimporter med rollback bestod før endelig commit, via Cloud SQL Auth Proxy 2.26.0 på localhost, uten eksterne databasenettverk. Alle felt og relasjoner samsvarer: 3 brukere, 16 områder, 7 steder, 8 menyvalg, 8 eiendeler, 77 oppgaver, 0 fokusøkter og 0 ukeoppsummeringer. ID-er og passordhasher er bevart, og de samme identitetene har adminrettigheter (én admin). Ingen prøveimportdata ble permanent skrevet før endelig commit.

Kjør eksport/import-programmet fra steg 1 mot Cloud SQL før produksjonstrafikk slippes på.

1. Eksporter fra en kopi av `prisma/dev.db`.
2. Importer til Cloud SQL i den dokumenterte tabellrekkefølgen.
3. Sammenlign antall rader per tabell.
4. Kontroller at alle relasjoner peker på eksisterende rader.
5. Kontroller at nøyaktig de forventede brukerne er admin.
6. Logg inn med en overført bruker og kontroller et utvalg oppgaver.
7. Slett testdata og gjenta hele prosessen minst én gang før endelig overgang.

Hvis importprogrammet kjøres fra lokal PC, bruk Cloud SQL Auth Proxy. Ikke åpne PostgreSQL-porten for hele internett.

## 16. Deploy Cloud Run uten produksjonstrafikk

Status: appen ble først opprettet privat med fast app-digest, runtime-konto, Cloud SQL og alle tre secrets på versjon 1. Cloud Run avviste `--no-traffic` ved første tjenesteoppretting. Første deploy ble derfor gjort med privat IAM og intern ruting, uten offentlig tilgang. Servicegrensen er `--max=1`, med 512 MiB, én CPU, concurrency 20 og minimum null instanser.

Ved første oppretting holdes tjenesten privat med `--no-allow-unauthenticated`; `--no-traffic` må utelates. Ved senere revisjoner kan `--no-traffic` brukes. En midlertidig `NEXTAUTH_URL` erstattes før offentlig åpning.

```powershell
gcloud run deploy $SERVICE `
  --image=$IMAGE `
  --region=$REGION `
  --service-account=$RUN_SA `
  --no-allow-unauthenticated `
  --add-cloudsql-instances=$CONNECTION_NAME `
  --set-secrets="DATABASE_URL=database-url:$DB_SECRET_VERSION,NEXTAUTH_SECRET=nextauth-secret:$AUTH_SECRET_VERSION,OPENAI_API_KEY=openai-api-key:$OPENAI_SECRET_VERSION" `
  --set-env-vars="NODE_ENV=production,NEXTAUTH_URL=https://placeholder.invalid,OPENAI_REALTIME_MODEL=gpt-realtime-2.1,OPENAI_REALTIME_VOICE=marin,OPENAI_REALTIME_SESSION_LIMIT_PER_MINUTE=5,OPENAI_REALTIME_MAX_SESSION_SECONDS=300" `
  --execution-environment=gen2 `
  --cpu=1 `
  --memory=512Mi `
  --concurrency=20 `
  --min-instances=0 `
  --max=1 `
  --timeout=60s `
  --port=8080
```

Containeren er allerede konfigurert til å lytte på `0.0.0.0` og port `8080`, som passer Cloud Run.

## 17. Sett korrekt NextAuth-URL og åpne trafikken

Status: appen er offentlig tilgjengelig på `https://neste-steg-tpiden7cga-lz.a.run.app`, som også er korrekt `NEXTAUTH_URL`. Appens innlogging og invitasjonsstyrte registrering gjelder fortsatt. Revisjon `neste-steg-00003-2ml` er Ready og har 100 prosent trafikk. Kun `roles/run.invoker` for `allUsers` ble lagt til ved offentlig åpning; runtime-kontoens tilgang er ikke utvidet.

```powershell
$SERVICE_URL = gcloud run services describe $SERVICE `
  --region=$REGION `
  --format="value(status.url)"

if (-not $SERVICE_URL) { throw "Fant ikke Cloud Run URL" }

gcloud run services update $SERVICE `
  --region=$REGION `
  --max=1 `
  --update-env-vars="NEXTAUTH_URL=$SERVICE_URL" `
  --no-traffic

gcloud run services update-traffic $SERVICE `
  --region=$REGION `
  --to-latest

gcloud run services add-iam-policy-binding $SERVICE `
  --region=$REGION `
  --member=allUsers `
  --role=roles/run.invoker

Write-Host "Neste steg: $SERVICE_URL"
```

Et eget domene kan legges til senere. Da må `NEXTAUTH_URL` oppdateres til det endelige HTTPS-domenet og en ny revisjon deployes.

## 18. Kjør produksjonstesten

Verifisert: HTTPS, anonyme redirects til innlogging, HTTP 401 på anonym Realtime-forespørsel, Secure/HttpOnly auth-cookie og CSRF-endepunkt. Kortlivede internt genererte JWT-testsesjoner for en overført admin og vanlig bruker bestod for sesjonsidentitet og databaseavhengige sider. Produksjonens Realtime-sesjonsoppretting bestod med 300 sekunders policy; ingen tokens eller hovednøkler ble vist. Innloggingssiden har ikke horisontal overflow på PC eller mobil. Samme image er deployet på nytt, og alle datafelt er fortsatt identiske med eksporten. Dette er ikke en test av faktisk passordinnlogging eller mikrofon i skyen. Eier må fortsatt teste vanlig innlogging, oppgaveflyt, eierskapsisolasjon, PC-/mobilmikrofon, utlogging og øvrige manuelle punkter nedenfor. Ikke marker den manuelle produksjonsgodkjenningen som fullført ennå.

Utfør testen på både PC og mobil:

1. Åpne `$SERVICE_URL/login` og kontroller HTTPS.
2. Logg inn med en overført bruker.
3. Kontroller at en vanlig bruker bare ser egne oppgaver og eiendeler.
4. Kontroller at bare admin kan endre steder og menyinnstillinger.
5. Opprett, rediger, fullfør og slett en testoppgave.
6. Last siden på nytt og kontroller at dataene fortsatt finnes.
7. Logg ut og kontroller at beskyttede sider ikke er tilgjengelige.
8. Start taleagenten på PC og mobil.
9. Tillat mikrofon, snakk inn et oppgaveutkast og lagre oppgaven.
10. Kontroller at OpenAI API-nøkkelen aldri finnes i nettleserens respons, kildekode eller logger.
11. Kontroller at femminuttersgrensen og rate limiting virker.
12. Deploy samme image på nytt og kontroller at eksisterende innlogging og data fortsatt virker.

Les logger ved feil:

```powershell
gcloud run services logs read $SERVICE `
  --region=$REGION `
  --limit=100
```

Ikke logg passord, database-URL, session-token, API-nøkkel eller rå lyd.

## 19. Gjør den endelige dataovergangen

Teknisk overgang gjennomført: siste tidsstemplede SQLite-kopi ble eksportert, to transaksjonelle skytester bestod, og endelig import ble committed til tidligere tomme måltabeller. Ingen produksjonstabeller eller migreringshistorikk ble tømt. Data og adminidentiteter er verifisert, også etter redeploy. Lokal SQLite-kilde er hash-verifisert uendret siden eksport; siste backup er også kopiert til `C:\dev\neste-steg-backup\dev-final-20261006-174215.db` og hash-verifisert. Begge lokale importproxyer og gammel dev-server er stoppet. Lokal SQLite-kilde og backup beholdes som rollback-kopier; bruk skyadressen for videre arbeid etter manuell sluttkontroll. Ikke importer snapshotet på nytt over eksisterende skydata.

Når prøveimport og produksjonstest er godkjent:

1. Varsle om et kort vedlikeholdsvindu.
2. Stopp all skriving i den lokale løsningen.
3. Ta en siste tidsstemplet kopi av `prisma/dev.db`.
4. Tøm bare data som kom fra prøveimporten, ikke schema eller migreringshistorikk.
5. Kjør den endelige eksporten fra SQLite.
6. Kjør den endelige importen til Cloud SQL.
7. Sammenlign radantall og stikkprøver.
8. Test innlogging, admin-rettigheter, oppgaver og taleagent på nytt.
9. Gjør Cloud Run-URL-en eller det nye domenet til brukerens faste adresse.
10. Behold den lokale databasen uendret og frakoblet som rollback-kopi til skyversjonen har vært stabil i minst noen uker.

## 20. Sett opp kostnadskontroll og overvåking

Opprettet: prosjektbudsjett `Neste-steg-runprice`, 50 NOK per måned med terskler 50/80/100 prosent, ID `43ce0b5c-4cfa-4cb4-aa5f-714101cc5d0e`. Dette følger beløpet i eksisterende kontobudsjett og er varsling, ikke en hard forbruksgrense; Cloud SQL kan koste mer enn 50 NOK per måned. Monitoring-e-postkanal bruker aktiv Google-konto. Feilvarsel `projects/runprice/alertPolicies/11594632248434240869` utløses ved mer enn fem Cloud Run 5xx i fem minutter. Lagringsvarsel `projects/runprice/alertPolicies/4591055979024842124` gjelder SQL-disk over 80 prosent i fem minutter. Varslene er opprettet, men faktisk e-postlevering er ikke provosert eller bekreftet. Eier har tidligere bekreftet OpenAI-forbruksinnstillinger.

1. Opprett et Google Cloud-budsjett avgrenset til prosjekt `294460811969` med varsler, for eksempel ved 50, 80 og 100 prosent.
2. Husk at vanlige budsjettvarsler ikke automatisk stopper forbruk. Vurder en spend cap hvis kontoen og tjenestene støtter dette.
3. Sett forbruksvarsler og hard grense for OpenAI-prosjektet.
4. Aktiver varsling for Cloud Run-feilrate og Cloud SQL-lagringsbruk.
5. Kontroller kostnadsrapporten daglig den første uken og ukentlig den første måneden.

Cloud Run kan skaleres til null. Cloud SQL kjører kontinuerlig og vil normalt være den største faste Google Cloud-kostnaden i dette oppsettet.

## 21. Test backup og gjenoppretting

Bestått: backup etter import `1791316318928`, beskrivelse `post-migration-verified-20261006`, er SUCCESSFUL. Backupen ble gjenopprettet til separat `neste-steg-restore-check`; alle felt, passordhasher, ID-er, adminflagg og migreringshistorikk samsvarte med eksporten. Testinstansen ble slettet etter verifikasjon. Produksjonsinstansen ble ikke overskrevet. Automatisk backup `1791290002938` er også SUCCESSFUL, og PITR er aktivert. Lokal Ctrl-C avbrøt bare venting på backupen, ikke den vellykkede serveroperasjonen; status ble kontrollert før fortsettelse. Gjenopprettet database ble kontrollert via proxy og PostgreSQL-klient, ikke med en separat Cloud Run-revisjon og manuell innlogging.

En backup er først pålitelig når restore er testet.

1. Kontroller at automatiske Cloud SQL-backuper og PITR blir opprettet.
2. Gjenopprett en backup til en ny testinstans, ikke over produksjonsinstansen.
3. Koble en midlertidig Cloud Run-revisjon til testinstansen.
4. Kontroller innlogging og et utvalg data.
5. Dokumenter faktisk tidsbruk og nøyaktige restore-steg.
6. Slett testinstansen når testen er ferdig.

Gjenta restore-testen etter større schemaendringer og minst et par ganger i året.

## 22. Dokumenter rollback

Testet applikasjonsrollback: trafikk til `neste-steg-00002-7c8` og HTTPS-kontroll bestod; deretter ble 100 prosent trafikk returnert til `neste-steg-00003-2ml`. Begge bruker samme faste image og korrekte secretversjoner/innloggingsadresse. Databasegjenoppretting til separat instans og dataverifikasjon bestod i steg 21; produksjonsdata ble ikke rullet tilbake.

### Rull tilbake applikasjonen

Finn tidligere revisjoner:

```powershell
gcloud run revisions list `
  --service=$SERVICE `
  --region=$REGION
```

Send all trafikk til en tidligere fungerende revisjon:

```powershell
$OLD_REVISION = "sett-inn-revisjonsnavn"

gcloud run services update-traffic $SERVICE `
  --region=$REGION `
  --to-revisions="${OLD_REVISION}=100"
```

### Rull tilbake data

Ikke kjør automatiske destruktive nedmigreringer. Ved alvorlig databasefeil:

1. Stopp produksjonstrafikken eller sett appen i lesemodus.
2. Gjenopprett backup/PITR til en ny Cloud SQL-instans.
3. Verifiser den nye instansen.
4. Opprett en ny versjon av `database-url` som peker til den gjenopprettede instansen.
5. Deploy en kompatibel Cloud Run-revisjon med den nye secret-versjonen.
6. Flytt trafikken først etter verifisering.

Den lokale SQLite-kopien er siste utvei for rollback under selve flyttedagen.

## 23. Automatiser senere deployer

Når første manuelle produksjonssetting er stabil, legg bygg og deploy i CI/CD:

1. Kjør lint, tester og build.
2. Bygg et image med commit-ID som tag.
3. Kjør migreringsjobben én gang.
4. Deploy ny Cloud Run-revisjon uten trafikk.
5. Kjør smoke-test.
6. Flytt trafikken kontrollert.
7. Behold forrige revisjon tilgjengelig for rask rollback.

Ikke gi CI-kontoen bredere IAM-rettigheter enn den trenger.

## Kort go/no-go-sjekkliste

Produksjonstrafikk skal ikke åpnes før alle disse er bekreftet:

- [x] PostgreSQL er kanonisk produksjonsschema; Dockerfile bruker ikke `sed` for provider-bytte.
- [x] `prisma/migrations/` finnes og `prisma migrate deploy` virker i Cloud Run Job.
- [x] Produksjons-seed oppretter ikke en bruker med standardpassord.
- [x] SQLite-eksport og PostgreSQL-import er kjørt minst to ganger uten avvik.
- [x] Radantall og relasjoner er kontrollert.
- [x] Åpen registrering er deaktivert eller forsvarlig sikret.
- [x] Tidligere delt OpenAI-nøkkel er tilbakekalt (eierbekreftet).
- [x] Alle secrets ligger i Secret Manager med eksplisitte versjoner.
- [x] Cloud SQL-backup og PITR er aktivt.
- [x] Budsjettvarsler er opprettet hos Google Cloud og OpenAI (OpenAI eierbekreftet).
- [ ] PC- og mobiltest, inkludert mikrofon, er bestått.
- [x] Rollback av både Cloud Run og database er dokumentert og testet (database til separat instans).

## Offisielle kilder

- [Installere Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- [Deploy container-images til Cloud Run](https://docs.cloud.google.com/run/docs/deploying)
- [Cloud Run-regioner](https://docs.cloud.google.com/run/docs/locations)
- [Koble Cloud Run til Cloud SQL for PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL-regioner](https://docs.cloud.google.com/sql/docs/postgres/locations)
- [Cloud SQL backup og point-in-time recovery](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/configure-pitr)
- [Secret Manager i Cloud Run](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Opprette secrets](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
- [Opprette Artifact Registry repository](https://cloud.google.com/artifact-registry/docs/repositories/create-repos)
- [Cloud Run Jobs CLI](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/deploy)
- [Prisma-migrering i produksjon](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)
- [Prisma database connections og serverless pooling](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [OpenAI production best practices](https://developers.openai.com/api/docs/guides/production-best-practices)
- [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits)

