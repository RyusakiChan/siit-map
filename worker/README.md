# Ask assistant Worker

A small Cloudflare Worker that answers questions for the SIIT Map "Ask" button. It holds the Anthropic API key, so the key never reaches the page. It answers from `src/data/building.json` plus the group FAQ in `src/data/faq.json`, using Claude Haiku 5.5 (`claude-haiku-5-5`, low effort).

`POST /chat` takes `{messages, lang, here?}` and returns `{reply, actions[]}`. Actions are `show_room`, `show_dept`, `show_route` and `source`. The Worker checks that every room, department and link exists before returning it.

## What it never does

- It never logs message text (only an error class when a call fails).
- It never accepts a call from another website: CORS and a check of the `Origin` header allow only `https://ryusakichan.github.io`.
- It limits each question to 300 characters, sends at most the last 10 messages, and caps the answer at 600 tokens.

## Run it locally (no key, no account)

With no `ANTHROPIC_API_KEY` the Worker is in **mock mode** and returns canned answers built from the same data.

```bash
npm run worker:dev
```

Then start the app against it:

```bash
VITE_ASSISTANT_URL=http://127.0.0.1:8787 npm run dev
```

`worker:dev` forces mock mode and also allows `http://localhost` origins. A deployed Worker allows neither.

Browser check at phone sizes (needs Chrome installed): `node scripts/ask-e2e.mjs <outDir>`. Add `--error` after stopping the Worker to check the error state.

## Setup for the owner (once)

You create the accounts and the key. Nobody else should handle the key.

1. **Cloudflare account:** sign up at https://dash.cloudflare.com (the free plan is enough).
2. **Log in from this folder:**
   ```bash
   npx wrangler login
   ```
3. **Anthropic account and key:** at https://console.anthropic.com create an API key for this project only.
4. **Set a monthly spend cap** in the Anthropic console (Settings, Limits). Pick an amount you are happy to lose, for example 5 USD. Do this before step 5.
5. **Store the key as a secret** (it is asked for on the screen and never written to a file):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml
   ```
6. **Deploy:**
   ```bash
   npx wrangler deploy --config worker/wrangler.toml
   ```
   Wrangler prints the address, like `https://siit-map-ask.<your-name>.workers.dev`.
7. **Check it:** open that address in a browser. You should see `{"ok":true,"mock":false}`. `mock:true` means the key is missing.
8. **Switch the assistant on:** put the address in `assistantUrl` in `src/config.ts` (no trailing slash), then build and publish the site as usual. An empty `assistantUrl` hides the button.

### Daily limit

The Worker limits each IP address to 30 questions a minute (`wrangler.toml`, `[[ratelimits]]`) and 100 questions a day (`DAILY_LIMIT` in `src/index.ts`). Cloudflare's limiter only counts 10 or 60 seconds, so the daily limit uses a KV store, already set up for the live Worker. On a new Cloudflare account, create one:

```bash
npx wrangler kv namespace create DAILY --config worker/wrangler.toml
```

Put the id it prints in the `[[kv_namespaces]]` block in `wrangler.toml` and deploy again. Without the block, the per-minute limit and your spend cap still protect you.

## Updating the answers

The Worker bundles the building data and the FAQ when it is deployed. After the group edits `src/data/faq.json` or `building.json`, deploy again (step 6).

## Cost

About 4,000 to 4,500 tokens of building data and FAQ go in with every question, plus the question itself. At Haiku 5.5 prices (0.10 USD per million input tokens, 0.50 USD per million output tokens) one question costs roughly 0.0005 to 0.001 USD, so about 1,000 questions cost under 1 USD. The data block is marked for prompt caching. The minimum cacheable size for Haiku 5.5 is 512 tokens, so the 4,000-token block qualifies and repeat questions within the cache window read it at a fraction of the input price. The numbers above are estimates for the uncached case; the token count could not be measured with the SDK because that call needs an API key. After the first real questions, the cost can be checked in the Anthropic console.
