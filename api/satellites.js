export default async function handler(req, res) {
  // Set CORS headers so our frontend can read it safely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Fetch from CelesTrak using a highly stable TLE group format
    const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json-pretty';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(200).json([]);
    }

    const data = await response.json();
    
    // Ensure we are returning a valid array back to our frontend app
    return res.status(200).json(Array.isArray(data) ? data : []);

  } catch (error) {
    console.error('Proxy Execution Failure:', error);
    return res.status(200).json([]);
  }
}
