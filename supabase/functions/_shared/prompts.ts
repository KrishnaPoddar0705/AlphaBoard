// Structured prompts for research report parsing

export const RESEARCH_REPORT_EXTRACTION_PROMPT = `You are an expert equity research analyst trained to parse institutional-grade research reports.

Your task is to extract structured information from this research PDF. Be precise and concise. Do not hallucinate or make up information. Always cite exact page references where you found information.

Extract the following fields and return them as a valid JSON object:

{
  "report_id": "<will be filled by system>",
  "title": "Extract the report title",
  "sector_outlook": "Overall outlook/thesis for the sector covered in this report",
  "key_drivers": ["List of key market/sector drivers mentioned", "Driver 2", "Driver 3"],
  "company_ratings": [
    {
      "company": "Company name or ticker",
      "rating": "BUY/SELL/HOLD/OUTPERFORM/etc",
      "rationale": "Brief rationale for the rating"
    }
  ],
  "valuation_summary": "Summary of valuation methodology and key multiples (P/E, EV/EBITDA, DCF, target prices, etc.)",
  "risks": ["Major risk 1", "Major risk 2", "Major risk 3"],
  "catalysts": ["Key catalyst 1", "Key catalyst 2", "Key catalyst 3"],
  "charts_and_tables": [
    {
      "description": "Description of chart/table content",
      "page": 5
    }
  ],
  "price_forecasts": [
    {
      "asset": "Commodity, stock, or index name",
      "forecast": "Price level or range",
      "timeframe": "Time period for forecast"
    }
  ],
  "regulatory_changes": ["Regulatory or policy change 1", "Change 2"],
  "financial_tables": [
    {
      "description": "What financial data is shown (EPS, Revenue, EBITDA, margins, etc.)",
      "page": 12,
      "data": "Key numbers or summary"
    }
  ],
  "summary_sentence": "One sentence summarizing the key takeaway from this report",
  "one_paragraph_thesis": "A concise paragraph (3-5 sentences) summarizing the investment thesis or recommendation",
  "three_key_insights": [
    "Most important insight #1",
    "Most important insight #2",
    "Most important insight #3"
  ],
  "three_risks": [
    "Top risk #1",
    "Top risk #2",
    "Top risk #3"
  ],
  "three_catalysts": [
    "Top catalyst #1",
    "Top catalyst #2",
    "Top catalyst #3"
  ],
  "three_actionables": [
    "Actionable recommendation #1",
    "Actionable recommendation #2",
    "Actionable recommendation #3"
  ],
  "citations": [
    {
      "text": "Direct quote or key finding",
      "page": 7,
      "source": "Section or chart name if applicable"
    }
  ]
}

IMPORTANT RULES:
1. Return ONLY valid JSON - no markdown code blocks, no extra text
2. If a field has no data in the report, use empty string "" or empty array []
3. Page numbers must be integers
4. Be precise with citations - include exact page numbers where you found the information
5. For company_ratings, extract ALL companies mentioned with ratings
6. For financial_tables, summarize key numbers (don't include entire tables)
7. Keep insights, risks, and catalysts distinct and non-overlapping
8. Make actionables specific and practical (e.g., "Buy XYZ target $100", "Exit ABC positions")

Now analyze the provided PDF and extract the structured data.`;

export const RAG_QUERY_PROMPT_TEMPLATE = (query: string, context: string) => `
You are an AI research assistant with access to a library of institutional research reports.

Context filters: ${context}

User query: ${query}

Based on the research reports provided, answer the user's query comprehensively.

Requirements:
1. Provide a clear, well-structured answer
2. Cite specific reports and page numbers where you found relevant information
3. If multiple reports have conflicting information, acknowledge the differences
4. If you cannot find relevant information in the reports, say so explicitly
5. Format your response as JSON:

{
  "answer": "Your comprehensive answer to the query (2-4 paragraphs)",
  "citations": [
    {
      "excerpt": "Relevant quote or finding from report",
      "page": 10,
      "source": "Report name or identifier if available"
    }
  ],
  "relevant_reports": ["List of report IDs or names that were most relevant to answering this query"]
}

Return ONLY valid JSON.`;

export const SUMMARY_GENERATION_PROMPT = (reportTitle: string) => `
Generate a 2-3 sentence executive summary for a research report titled "${reportTitle}".

Focus on:
- Main investment thesis
- Key recommendation (BUY/SELL/HOLD)
- Primary catalyst or risk

Keep it concise and actionable.`;

export const KNOWLEDGE_GRAPH_EXTRACTION_PROMPT = `
Extract entities and relationships from this research report for knowledge graph construction.

Return JSON:
{
  "entities": [
    {
      "type": "COMPANY|SECTOR|COMMODITY|PERSON|REGULATORY_BODY",
      "name": "Entity name",
      "mentioned_on_pages": [1, 5, 10]
    }
  ],
  "relationships": [
    {
      "source": "Entity A",
      "relationship": "COMPETES_WITH|SUPPLIES_TO|REGULATED_BY|OUTPERFORMS",
      "target": "Entity B"
    }
  ],
  "topics": ["Topic 1", "Topic 2", "Topic 3"]
}`;

