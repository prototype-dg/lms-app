/**
 * Sohar International Green Home Demo
 * VPS OCR Sidecar Service — Google Vision API + GPT-4o
 * Runs on port 4000
 */

const http = require('http');
const https = require('https');
const { Buffer } = require('buffer');

const GOOGLE_VISION_KEY = 'AIzaSyBqQ4THcUG8wpRZbB2olfZqvR9mI1e-88E';
const OPENAI_KEY = 'REDACTED_OPENAI_KEY';
const PORT = 4000;

// ── helpers ──────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch(e) { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, statusCode, data) {
  cors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Google Vision OCR ─────────────────────────────────────────────────────────

async function visionOCR(base64Image, mimeType = 'application/pdf') {
  const feature = mimeType.includes('pdf') ? 'DOCUMENT_TEXT_DETECTION' : 'TEXT_DETECTION';
  const result = await httpsPost(
    'vision.googleapis.com',
    `/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
    {},
    {
      requests: [{
        image: { content: base64Image },
        features: [{ type: feature, maxResults: 1 }],
        imageContext: { languageHints: ['en', 'ar'] }
      }]
    }
  );
  if (result.status !== 200) throw new Error(`Vision API error: ${result.status}`);
  const resp = result.body.responses?.[0];
  const text = resp?.fullTextAnnotation?.text || resp?.textAnnotations?.[0]?.description || '';
  const pages = resp?.fullTextAnnotation?.pages?.length || 1;
  return { text, pages, confidence: resp?.fullTextAnnotation ? 0.97 : 0.85 };
}

// ── GPT-4o document validation ────────────────────────────────────────────────

async function gptValidate(ocrText, docType) {
  const prompts = {
    gsas_cert: `You are a green building compliance officer. Analyze this GSAS (Gulf Sustainability Assessment System) certificate text and extract:
1. GSAS score (0-100)
2. Project name
3. Issuing authority  
4. Validity date
5. Whether it qualifies for Sohar International Green Home Loan (score >= 70 required, >= 85 for premium 4.75% rate)
6. List of verified green features
Respond as JSON: {score, project_name, issuer, valid_until, qualifies, premium_rate, features[], confidence, recommendation}`,

    epc_report: `You are a building energy auditor. Analyze this EPC (Energy Performance Certificate) report text and extract:
1. Energy rating (A/B/C/D/E/F/G or A+/A/B/B+)
2. Primary energy consumption (kWh/m²/year)
3. CO2 emissions
4. HVAC details (SEER rating if present)
5. Whether it meets Sohar International green loan requirements (min B rating)
6. Any flags or issues
Respond as JSON: {rating, primary_energy, co2, hvac_seer, qualifies, flags[], confidence, recommendation}`,

    eia_approval: `You are an environmental compliance officer. Analyze this Environmental Impact Assessment approval document and extract:
1. Reference number
2. Issuing authority
3. Project name and location
4. Approval status (approved/conditional/rejected)
5. Validity period
6. Environmental conditions or restrictions
Respond as JSON: {reference, issuer, project, location, status, valid_until, conditions[], confidence, recommendation}`,

    invoice: `You are a green building materials compliance officer for a bank. Analyze this construction invoice and verify:
1. Invoice number and date
2. Total amount
3. List of materials — cross-reference against GSAS approved materials list
4. Whether all materials are from approved green suppliers
5. Flag any non-compliant or unknown materials
6. Overall compliance percentage
Respond as JSON: {invoice_number, date, total_amount, materials[], compliant_pct, flags[], confidence, recommendation, approve}`,

    civil_id: `Extract the following from this Omani Civil ID document:
1. Full name (Arabic and English)
2. Civil ID number  
3. Date of birth
4. Nationality
5. Expiry date
6. Whether valid (not expired)
Respond as JSON: {name_en, name_ar, civil_id, dob, nationality, expiry, valid, confidence}`,

    salary_cert: `Extract from this salary/employment certificate:
1. Employee name
2. Employer organization
3. Job title
4. Monthly salary (OMR)
5. Employment start date
6. Whether the certificate is recent (within 3 months)
Respond as JSON: {employee_name, employer, title, monthly_salary_omr, start_date, is_recent, confidence}`,
  };

  const prompt = prompts[docType] || prompts.invoice;
  const result = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { 'Authorization': `Bearer ${OPENAI_KEY}` },
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Document text to analyze:\n\n${ocrText.substring(0, 4000)}` }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }
  );

  if (result.status !== 200) throw new Error(`OpenAI error: ${result.status} — ${JSON.stringify(result.body)}`);
  try {
    return JSON.parse(result.body.choices[0].message.content);
  } catch(e) {
    return { raw: result.body.choices[0].message.content, confidence: 0.7 };
  }
}

// ── Demo fallbacks (when no real document is provided) ────────────────────────

function demoFallback(docType) {
  const fallbacks = {
    gsas_cert: {
      score: 89, project_name: 'EcoVillage Muscat', issuer: 'Gulf Organisation for Research & Development',
      valid_until: '2027-12-31', qualifies: true, premium_rate: true,
      features: ['Solar PV 8.5kWp', 'Greywater recycling', 'Green roof', 'HVAC SEER 18.2', 'Low-E glazing'],
      confidence: 0.96, recommendation: 'Auto-approved. GSAS score 89 qualifies for 4.75% preferential rate.'
    },
    epc_report: {
      rating: 'B+', primary_energy: 88, co2: 18.4, hvac_seer: 18.2,
      qualifies: true, flags: ['Minor thermal bridging at window reveals — within tolerance'],
      confidence: 0.88, recommendation: 'Accepted with minor flag. Manual review recommended for thermal bridging note.'
    },
    eia_approval: {
      reference: 'EIA-2024-0892', issuer: 'Ministry of Environment and Climate Affairs',
      project: 'EcoVillage Muscat', location: 'Al Mouj, Muscat Governorate',
      status: 'approved', valid_until: '2026-12-31',
      conditions: ['Dust suppression plan required during construction', 'Protected fauna corridor to remain undisturbed'],
      confidence: 0.95, recommendation: 'EIA approval confirmed. All conditions documented.'
    },
    invoice: {
      invoice_number: 'GC-2025-0089', date: '2025-01-28', total_amount: 48750,
      materials: [
        { name: 'Rockwool thermal insulation', supplier: 'Rockwool Oman', gsas_approved: true },
        { name: 'Saint-Gobain Low-E Glass', supplier: 'Saint-Gobain', gsas_approved: true },
        { name: 'Structural steel (Grade 60)', supplier: 'Oman Steel', gsas_approved: true },
        { name: 'Ready-mix concrete (350 PSI)', supplier: 'Gulf Concrete', gsas_approved: true },
      ],
      compliant_pct: 97, flags: ['Steel price variance ±3% vs approved schedule — within tolerance'],
      confidence: 0.93, recommendation: 'Invoice compliant. Green materials verified. Approved for tranche release.', approve: true
    },
    civil_id: {
      name_en: 'Salim Mohammed Al-Harthy', name_ar: 'سالم محمد الحارثي',
      civil_id: '8827364', dob: '1985-03-15', nationality: 'Omani',
      expiry: '2027-06-30', valid: true, confidence: 0.97
    },
    salary_cert: {
      employee_name: 'Salim Mohammed Al-Harthy', employer: 'Oman Oil Company',
      title: 'Senior Engineer', monthly_salary_omr: 3200,
      start_date: '2018-04-01', is_recent: true, confidence: 0.94
    }
  };
  return fallbacks[docType] || fallbacks.invoice;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health' || url.pathname === '/') {
    return json(res, 200, {
      status: 'ok',
      service: 'Sohar International OCR Sidecar',
      version: '1.0.0',
      google_vision: 'configured',
      openai: 'configured',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  // POST /ocr — extract text from document image/pdf
  if (url.pathname === '/ocr' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { base64, mime_type = 'image/jpeg', demo = false } = body;

      if (demo || !base64) {
        // Return demo OCR text
        return json(res, 200, {
          text: 'GSAS CERTIFICATE\nProject: EcoVillage Muscat\nScore: 89/100\nIssuer: GORD\nValid: 2027-12-31\nSolar PV: 8.5kWp\nGreywater: Yes',
          pages: 1, confidence: 0.97, source: 'demo'
        });
      }

      const result = await visionOCR(base64, mime_type);
      return json(res, 200, { ...result, source: 'google_vision' });
    } catch(e) {
      console.error('OCR error:', e.message);
      return json(res, 500, { error: e.message });
    }
  }

  // POST /validate — OCR + AI validation combined
  if (url.pathname === '/validate' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { base64, mime_type = 'image/jpeg', doc_type = 'gsas_cert', demo = false } = body;

      let ocrText, ocrSource;

      if (demo || !base64) {
        // Skip real OCR in demo mode
        ocrText = `DEMO DOCUMENT — ${doc_type.toUpperCase()}`;
        ocrSource = 'demo';
      } else {
        const ocrResult = await visionOCR(base64, mime_type);
        ocrText = ocrResult.text;
        ocrSource = 'google_vision';
      }

      let aiResult;
      if (demo || !base64 || ocrText.length < 20) {
        aiResult = demoFallback(doc_type);
        aiResult._source = 'demo_fallback';
      } else {
        try {
          aiResult = await gptValidate(ocrText, doc_type);
          aiResult._source = 'gpt4o';
        } catch(e) {
          console.warn('GPT fallback:', e.message);
          aiResult = demoFallback(doc_type);
          aiResult._source = 'demo_fallback_on_error';
        }
      }

      return json(res, 200, {
        doc_type,
        ocr: { text: ocrText.substring(0, 500), source: ocrSource },
        validation: aiResult,
        processed_at: new Date().toISOString()
      });
    } catch(e) {
      console.error('Validate error:', e.message);
      return json(res, 500, { error: e.message });
    }
  }

  // POST /analyze-invoice — specialized invoice AI check
  if (url.pathname === '/analyze-invoice' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { base64, demo = false } = body;

      if (demo || !base64) {
        return json(res, 200, { validation: demoFallback('invoice'), source: 'demo' });
      }

      const { text } = await visionOCR(base64, 'image/jpeg');
      const validation = await gptValidate(text, 'invoice');
      return json(res, 200, { validation, ocr_text: text.substring(0, 300), source: 'live' });
    } catch(e) {
      console.error('Invoice error:', e.message);
      return json(res, 200, { validation: demoFallback('invoice'), source: 'demo_fallback', error: e.message });
    }
  }

  // 404
  return json(res, 404, { error: 'Not found', paths: ['/health', '/ocr', '/validate', '/analyze-invoice'] });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sohar OCR Sidecar running on port ${PORT}`);
  console.log(`   Google Vision: configured`);
  console.log(`   OpenAI: configured`);
  console.log(`   Endpoints: /health /ocr /validate /analyze-invoice`);
});

process.on('uncaughtException', e => console.error('Uncaught:', e.message));
process.on('unhandledRejection', e => console.error('Unhandled:', e));
