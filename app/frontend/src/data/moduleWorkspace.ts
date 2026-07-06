import type { ModuleWorkspace } from "@/types";
import { FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT } from "@/content/simulations";

export const MA_DUE_DILIGENCE_MODULE: ModuleWorkspace = {
  id: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.slug,
  caseCode: "SW-LEGAL-184",
  category: "LEGAL",
  title: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.title,
  artifactLabel: "Issue log and associate summary",
  evidenceType: "Agreement packet",
  caseMarkdown: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.caseMarkdown,
  evaluationMarkdown: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.evaluationMarkdown,
  readyPath: "/simulations/first-year-associate-ma-due-diligence/ready",
  storageKey: "simworks:first-year-associate-ma-due-diligence",
  casePdf: {
    title: "Rivergate / Harbor bank merger evidence packet",
    fileName: "rivergate-harbor-merger-evidence-packet.md",
    pageCount: 9,
    pages: [
      {
        heading: "Cover Note",
        kicker: "Confidential case PDF · Page 1",
        body: [
          "Rivergate National Bank is evaluating a merger with Harbor Community Bank. Rivergate would be the surviving national banking association.",
          "The draft agreement is a form adapted for a bank merger. It contains blanks, optional drafting notes, and unresolved business terms. The supervising associate wants a diligence work product, not a redline.",
          "Assume Rivergate is our client. Focus on what must be verified before the agreement can be marked ready for signature, approval filings, shareholder action, and closing.",
        ],
        evidence: [
          "Draft merger agreement",
          "Supervising associate prompt",
          "Required learner deliverables",
        ],
      },
      {
        heading: "Parties and Authority",
        kicker: "Agreement excerpt · Page 2",
        body: [
          "The preamble identifies Rivergate National Bank as a national banking association and Harbor Community Bank as a state-chartered banking association, but the legal names, main office addresses, counties, states, capital, surplus, undivided profits, and approval dates are blank.",
          "The recitals say each board has authorized execution and that certified resolutions will be delivered. No board resolutions, secretary certificates, officer incumbency evidence, charter documents, or good-standing or regulatory status confirmations are attached.",
          "Section 1 states Harbor will merge into Rivergate under Rivergate's charter, with Rivergate as the surviving national banking association. The same transaction direction must match board approvals, regulatory filings, shareholder materials, and closing certificates.",
        ],
        evidence: [
          "Preamble identity fields",
          "Board authorization recital",
          "Surviving bank clause",
        ],
      },
      {
        heading: "Regulatory Approval Path",
        kicker: "Agreement excerpt · Page 3",
        body: [
          "The draft says the merger is subject to approval by the Comptroller of the Currency and will become effective when the OCC approves and the merger certificate is issued. The draft does not include a filing timetable, responsibility matrix, expected approval conditions, or state-bank approval analysis.",
          "Because Harbor is state-chartered, the team must confirm whether state banking regulator consent, state merger filings, publication requirements, or additional conditions apply. The agreement currently treats OCC approval as the only developed regulatory path.",
          "The form does not say whether regulatory counsel has reviewed the structure, the filing package, branch consequences, trust department activities, or capital impact of the merger.",
        ],
        evidence: [
          "OCC approval condition",
          "State bank overlay",
          "Filing timetable missing",
        ],
      },
      {
        heading: "Shareholder Approval",
        kicker: "Agreement excerpt · Page 4",
        body: [
          "Section 12 requires approval by shareholders owning at least two-thirds of each bank's outstanding capital stock, except that the state-chartered bank may require a higher vote under its governing law.",
          "The draft does not include record dates, meeting dates, notice timing, proxy or information statement responsibilities, voting classes, broker or nominee mechanics, or any dissenters' or appraisal rights analysis.",
          "The shareholder list, outstanding share count, beneficial ownership records, option or warrant schedule, and any preferred or special voting rights are not included in the packet.",
        ],
        evidence: [
          "Two-thirds approval language",
          "Possible higher state-law threshold",
          "Shareholder meeting mechanics",
        ],
      },
      {
        heading: "Capital and Financial Terms",
        kicker: "Financial evidence · Page 5",
        body: [
          "The draft requires capital stock, surplus, undivided profits, acceptable assets, book value, fair value, and purchase accounting adjustments to be confirmed through closing.",
          "The statement-of-condition date is blank. There are no audited financial statements, interim financial statements, call reports, regulatory capital calculations, acceptable-asset schedule, valuation support, or accounting adjustment methodology in the packet.",
          "The draft assumes assets contributed to Rivergate will be acceptable to Rivergate and valued appropriately, but it does not identify who decides acceptability, how disputes are resolved, or whether the bank will remain adequately capitalized after closing.",
        ],
        evidence: [
          "Capital stock blanks",
          "Acceptable asset contribution language",
          "Book value and fair value support",
        ],
      },
      {
        heading: "Consideration Mechanics",
        kicker: "Agreement excerpt · Page 6",
        body: [
          "Section 7 describes stock consideration, exchange ratios, cash payments, fractional shares, and possible scrip certificates. The exchange ratio, par value references, resulting ownership percentage, cash amount, and fractional-share treatment are unresolved.",
          "Optional drafting instructions remain in the text for cash-in-lieu and scrip trustee mechanics. The draft does not identify a transfer agent, exchange agent, trustee, payment source, shareholder communication process, tax treatment, or securities-law review.",
          "The current form cannot support signature until the business team, regulatory counsel, and tax or accounting advisers confirm the consideration structure.",
        ],
        evidence: [
          "Exchange ratio blank",
          "Cash and fractional share options",
          "Scrip trustee drafting note",
        ],
      },
      {
        heading: "Assets and Liabilities",
        kicker: "Diligence evidence · Page 7",
        body: [
          "The draft provides that all assets vest in the surviving bank and that Rivergate assumes all liabilities of both banks, including liabilities arising from a trust department.",
          "The packet does not include schedules for litigation, threatened claims, regulatory inquiries, enforcement actions, customer disputes, fiduciary accounts, off-balance-sheet commitments, loan portfolio exceptions, real estate, leases, branch assets, or third-party consents.",
          "The trust department reference is a gating diligence item. The team needs trust account schedules, fiduciary obligation summaries, audit reports, customer claims, regulator correspondence, and confirmation of whether trust powers transfer cleanly.",
        ],
        evidence: [
          "Asset vesting provision",
          "Broad liability assumption",
          "Trust department liability reference",
        ],
      },
      {
        heading: "Interim Conduct and Governance",
        kicker: "Agreement excerpt · Page 8",
        body: [
          "Between signing and closing, the banks may not pay dividends or dispose of assets except in the ordinary course and for adequate value. The draft lacks a fuller operating covenant package, exception schedule, approval rights, leakage controls, ordinary-course definition, or bring-down condition.",
          "Section 9 says the surviving bank's board after closing will include named directors, but the names are blank. The packet lacks director eligibility materials, conflict disclosures, regulatory approvals, committee assignments, resignation letters, and governance approval evidence.",
          "Section 10 requires the surviving bank's articles of association to be attached. The attachment is missing, and the draft does not identify whether amendments or post-closing governance documents are required.",
        ],
        evidence: [
          "Dividend restriction",
          "Asset disposition restriction",
          "Board composition and articles attachment",
        ],
      },
      {
        heading: "Closing and Work Product",
        kicker: "Assignment · Page 9",
        body: [
          "Section 11 has a blank outside date and simple termination language. The draft does not include detailed closing conditions, bring-down certificates, legal opinions, final regulatory approval evidence, shareholder approval certificates, secretary certificates, officer certificates, or execution block details.",
          "Prepare a diligence issue log with at least twelve issues, a targeted request list with at least ten requests, and a concise associate summary under 350 words.",
          "Prioritize gating issues that could affect signing, regulatory approval, shareholder approval, or closing. Treat remaining optional drafting notes as cleanup items unless they affect deal mechanics.",
        ],
        evidence: [
          "Outside date blank",
          "Closing deliverables missing",
          "Issue log, request list, and associate summary",
        ],
      },
    ],
  },
  steps: [
    {
      id: "open-packet",
      label: "Open the evidence packet",
      description: "Review the case packet and orient around the bank merger structure.",
    },
    {
      id: "identify-issues",
      label: "Identify diligence issues",
      description: "Separate drafting cleanup from approval, capital, liability, and closing risks.",
    },
    {
      id: "draft-requests",
      label: "Draft the request list",
      description: "Ask for the documents and confirmations needed to resolve the issue log.",
    },
    {
      id: "final-check",
      label: "Complete associate summary",
      description: "State readiness, top gating issues, first workstream, and specialist input.",
    },
  ],
};
