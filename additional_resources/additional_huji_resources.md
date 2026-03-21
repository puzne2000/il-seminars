# Additional HUJI CS Seminar Resources

Extracted from the saved page source of:
`http://www.cs.huji.ac.il/news-events/seminars`
(The Rachel and Selim Benin School of Computer Science and Engineering, Hebrew University)

The site is an Angular app. Each seminar series has its own page under the base URL
`http://www.cs.huji.ac.il/news-events/<alias>`.

No iCal/RSS feed URLs were found embedded in the page. Each series page would need to be
scraped directly or checked for a feed link.

## Seminar Series

| Series Name | Page URL |
|---|---|
| Computer Science Colloquium | `http://www.cs.huji.ac.il/news-events/colloquium` |
| The Artificial Intelligence (AI) Seminar | `http://www.cs.huji.ac.il/news-events/the-artificial-intelligence-ai-seminar` |
| Theory of Computer Science Seminar | `http://www.cs.huji.ac.il/news-events/theory-of-computer-science-seminar` |
| Machine Learning Club | `http://www.cs.huji.ac.il/news-events/learning-club` |
| Distributed Algorithms, Networking and Secure Systems Seminar (DANSS) | `http://www.cs.huji.ac.il/news-events/distributed-algorithms-networking-and-security-seminar-danss` |
| Computation and Economics Seminar | `http://www.cs.huji.ac.il/news-events/computation-and-economics-seminar` |
| Critical MAS (Multi-Agent Systems) Seminar | `http://www.cs.huji.ac.il/news-events/mas-seminar` |
| Vision Seminar | `http://www.cs.huji.ac.il/news-events/vision-seminar` |
| Quantum Computation Seminar | `http://www.cs.huji.ac.il/news-events/quantum-computation-seminar` |
| Combinatorics Seminar | `http://www.cs.huji.ac.il/news-events/combinatorics-seminar` |
| Creative Engineering Seminar | `http://www.cs.huji.ac.il/news-events/creative-engineering-seminar` |

## Notes

- The site renders content client-side via Angular — a plain HTML GET may return a skeleton
  page without event data. The scraper will need to either use a headless browser or find
  a backend API endpoint that supplies the events JSON.
- The existing scraper already handles HUJI Mathematics pagination. These CS series are a
  separate site (`cs.huji.ac.il`) and will need their own scraper logic.
- The `eventItemsSiteIds` field in the page's `siteDataJson` is `"550"`, which may be the
  site ID used by the backend events API.
