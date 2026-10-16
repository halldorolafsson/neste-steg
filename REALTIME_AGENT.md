# Realtime taleagent

Neste steg bruker OpenAI Realtime API til en direkte talesamtale i nettleseren.
Nettleseren kobler til med WebRTC og får bare en kortlivet klientnøkkel. Den
vanlige OpenAI API-nøkkelen blir på serveren.

Agenten kan fylle ut et oppgaveutkast gjennom verktøyet `prepare_task_draft`.
Verktøyet lagrer ikke data. Brukeren må kontrollere skjemaet og trykke
**Opprett** før oppgaven lagres.

## Miljøvariabler

```dotenv
OPENAI_API_KEY="din-api-nøkkel"
OPENAI_REALTIME_MODEL="gpt-realtime-2.1"
OPENAI_REALTIME_VOICE="marin"
OPENAI_REALTIME_SESSION_LIMIT_PER_MINUTE="5"
OPENAI_REALTIME_MAX_SESSION_SECONDS="300"
```

API-nøkkelen skal ligge i `.env` lokalt og i skyleverandørens secret manager
ved produksjonsdrift. Den skal aldri ha prefikset `NEXT_PUBLIC_`.

## Lokal bruk

1. Start appen med `npm run dev`.
2. Åpne **Ny oppgave**.
3. Trykk **Start samtale** og tillat mikrofontilgang.
4. Beskriv oppgaven og svar på eventuelle oppfølgingsspørsmål.
5. Kontroller utkastet og trykk **Opprett**.

## Mobiltelefon

PC-en bruker Tailscale Serve for privat HTTPS-tilgang:

```text
https://stas-pc062.tail6827d8.ts.net
```

Telefonen må være tilkoblet samme Tailscale-nettverk. HTTPS er nødvendig for
mikrofontilgang. WebRTC sender lyd mellom nettleseren og OpenAI, mens
sesjonsopprettelse og oppgavehandlinger går gjennom Neste steg-serveren.

Tailscale-proxyen kan stoppes fra en administratorterminal med:

```powershell
tailscale serve --https=443 off
```

## Sikkerhetsgrenser

- Endepunktet for kortlivede nøkler krever en gyldig innlogget sesjon.
- En HMAC av intern bruker-ID sendes som OpenAI Safety Identifier.
- API-nøkkelen returneres aldri til nettleseren.
- Agentens verktøy kan bare fylle skjemaet og kan ikke skrive til databasen.
- Eksplisitt innsending av skjemaet bruker eksisterende autentisering og
  validering.
- En bruker kan som standard opprette maksimalt fem nye Realtime-sesjoner per
  minutt. Grensen kan justeres med `OPENAI_REALTIME_SESSION_LIMIT_PER_MINUTE`.
- Nettleseren avslutter som standard samtalen etter fem minutter. Grensen kan
  justeres med `OPENAI_REALTIME_MAX_SESSION_SECONDS`.

Den lokale rate limiteren lagres i minnet til én app-instans. Ved flere Cloud
Run-instanser må den erstattes eller suppleres med en delt limiter, for eksempel
Redis/Memorystore eller en kontroll ved ingress/API-gateway. Maksimal samtaletid
er en klientvakt og ikke en serverhåndhevet kostnadsgrense.

## Produksjonsoppsett

Sett et forbruksvarsel og en hard forbruksgrense i OpenAI Platform. Et varsel
stopper ikke trafikken, mens en hard grense gir HTTP 429 når den håndheves. Se
[OpenAI Spend Limits](https://developers.openai.com/api/docs/guides/spend-limits)
og
[Production best practices](https://developers.openai.com/api/docs/guides/production-best-practices).

Opprett API-nøkkelen som en hemmelighet i Google Secret Manager og bruk en
bestemt versjon i Cloud Run i stedet for `latest`:

```powershell
gcloud secrets create openai-api-key --replication-policy=automatic
gcloud secrets versions add openai-api-key --data-file=-
gcloud run services update SERVICE --region=REGION --update-secrets=OPENAI_API_KEY=openai-api-key:VERSION
```

Den andre kommandoen leser hemmeligheten fra standard input, slik at nøkkelen
ikke skrives inn i kommandohistorikken. Se
[Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
og
[Secret Manager best practices](https://docs.cloud.google.com/secret-manager/docs/best-practices).
