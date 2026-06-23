/* ============================================================
   content.js — ALL training content lives here
   Your L&D team edits THIS file to add/change modules,
   slides, and quiz questions. No backend changes needed.

   STRUCTURE
     INDUCTION = [ module, module, ... ]
     each module = {
        id, num, title, summary,
        slides: [ {eye, h, body, bullets:[...]} ],
        quiz:   [ {q, options:[...], answer: <index of correct option>} ]
     }
   PASS RULE: 90% (handled by backend + portal.js)
   ============================================================ */

const INDUCTION = [
  {
    id: "ind-1",
    num: "MODULE 1",
    title: "Welcome to Mr. Golisoda",
    summary: "Who we are, our story, and what makes our soda special.",
    slides: [
      { eye:"Our Story", h:"From one bottle to a movement",
        body:"South Asian Food &amp; Beverages LLP was founded in June 2018 by Chandru and Aziz. What began as a single soda brand has grown into a franchise-based beverage company present across 9+ states with 60+ franchise partners.",
        bullets:["Founded: June 2018","Founders: Chandru (CEO) &amp; Aziz","Mission: 500 manufacturing factories pan-India"] },
      { eye:"Our Product", h:"The glass-bottle goli soda",
        body:"Our signature product is the classic glass-bottle soda, loved for its taste and nostalgia, alongside modern PET bottles for wider reach.",
        bullets:["Glass bottle: a nostalgic favourite","PET bottle: convenient &amp; portable","Quality and taste come first, always"] },
      { eye:"Our People", h:"One team, one mission",
        body:"Every person — from plant to field — plays a role in delivering quality and growing the brand. Welcome aboard."  ,
        bullets:["Field Sales","Production &amp; Plant","Corporate &amp; L&amp;D"] }
    ],
    quiz: [
      { q:"In which year was the company founded?",
        options:["2016","2018","2020","2021"], answer:1 },
      { q:"Who are the founders of the company?",
        options:["Chandru and Aziz","Chandru and Suresh","Aziz and Kumar","Chandru only"], answer:0 },
      { q:"What is the company's stated mission?",
        options:["100 factories in Tamil Nadu","500 manufacturing factories pan-India","Export to 50 countries","1000 franchise partners"], answer:1 },
      { q:"Which is our signature, nostalgic product?",
        options:["PET bottle juice","Glass-bottle goli soda","Energy drink","Packaged water"], answer:1 },
      { q:"Across how many states is the company present?",
        options:["3+ states","5+ states","9+ states","15+ states"], answer:2 }
    ]
  },
  {
    id: "ind-2",
    num: "MODULE 2",
    title: "Our Values & Culture",
    summary: "How we work, what we stand for, and how we treat each other.",
    slides: [
      { eye:"Our Values", h:"What we stand for",
        body:"Our culture is built on honesty, discipline, ownership, and respect. These guide every decision in the field and the plant.",
        bullets:["Honesty in every transaction","Discipline in daily work","Ownership of results","Respect for every colleague &amp; partner"] },
      { eye:"Discipline", h:"Daily discipline wins",
        body:"Small daily habits — punctuality, accurate reporting, following process — are what build a strong, trusted brand.",
        bullets:["Be on time, every time","Report numbers accurately","Follow the process"] }
    ],
    quiz: [
      { q:"Which of these is a core company value?",
        options:["Shortcuts","Ownership","Blame","Secrecy"], answer:1 },
      { q:"What builds a strong, trusted brand?",
        options:["Occasional effort","Small daily disciplined habits","Only big launches","Avoiding reports"], answer:1 },
      { q:"How should numbers be reported?",
        options:["Roughly","Accurately","Only when asked","Once a month"], answer:1 },
      { q:"How do we treat colleagues and partners?",
        options:["With respect","With suspicion","Indifferently","Only when convenient"], answer:0 },
      { q:"Which habit reflects discipline?",
        options:["Being late","Punctuality","Skipping process","Guessing figures"], answer:1 }
    ]
  },
  {
    id: "ind-3",
    num: "MODULE 3",
    title: "Know Our Products",
    summary: "The basics every employee must know about what we make and sell.",
    slides: [
      { eye:"The Glass Bottle", h:"Our hero product",
        body:"The glass-bottle soda is our hero. It is affordable, loved, and profitable. Recipes are adjusted regionally (sugar and CO₂ differ across South, North and West).",
        bullets:["Loved for taste &amp; nostalgia","Region-adjusted recipe","Affordable for everyone"] },
      { eye:"The PET Bottle", h:"Modern convenience",
        body:"PET bottles extend our reach to customers who want a portable, modern format. Together, glass and PET cover every customer need."  ,
        bullets:["Portable &amp; convenient","Wider customer reach","Complements the glass bottle"] }
    ],
    quiz: [
      { q:"Which is described as our 'hero product'?",
        options:["PET bottle","Glass-bottle soda","Energy drink","Water"], answer:1 },
      { q:"Why do recipes differ by region?",
        options:["Different bottles","Sugar and CO₂ levels differ","Different logos","No reason"], answer:1 },
      { q:"What is the main advantage of the PET bottle?",
        options:["Cheaper glass","Portability &amp; convenience","Better taste only","Heavier weight"], answer:1 },
      { q:"Together, glass and PET aim to…",
        options:["Confuse customers","Cover every customer need","Replace each other","Raise prices"], answer:1 },
      { q:"The glass bottle is valued for…",
        options:["Taste and nostalgia","Its weight","Being imported","Its packaging only"], answer:0 }
    ]
  }
];
