/**
 * Seed script - populates the documents collection with 10,000+ wiki-style documents.
 * ~10% of documents use the OLD author schema (string) to support schema migration testing.
 */

const { getDB } = require("../db");
const { generateSlug } = require("./slugify");

// ---- Wikipedia-inspired topic corpus ----
const TOPICS = [
  "Artificial Intelligence", "Machine Learning", "Deep Learning", "Natural Language Processing",
  "Computer Vision", "Reinforcement Learning", "Neural Networks", "Transformers in AI",
  "MongoDB", "PostgreSQL", "Redis", "Cassandra", "DynamoDB", "Elasticsearch", "Neo4j",
  "Node.js", "Express.js", "FastAPI", "Django", "Flask", "Spring Boot", "NestJS",
  "React", "Vue.js", "Angular", "Svelte", "Next.js", "Nuxt.js", "Remix",
  "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions",
  "REST API", "GraphQL", "gRPC", "WebSockets", "HTTP/2", "WebRTC",
  "Microservices", "Monolithic Architecture", "Serverless Computing", "Event-Driven Architecture",
  "Bitcoin", "Ethereum", "Blockchain", "Smart Contracts", "DeFi", "NFTs",
  "Quantum Computing", "Edge Computing", "Fog Computing", "Cloud Native",
  "Cybersecurity", "Zero Trust Security", "Penetration Testing", "OWASP",
  "Linux Kernel", "GNU/Linux", "Ubuntu", "Fedora", "Arch Linux", "Debian",
  "Python Programming", "JavaScript", "TypeScript", "Rust Programming", "Go Language",
  "Java Programming", "C++ Programming", "Haskell", "Erlang", "Elixir",
  "Data Structures", "Algorithms", "Big O Notation", "Sorting Algorithms", "Graph Theory",
  "Operating Systems", "Memory Management", "Process Scheduling", "Virtual Memory",
  "Networking Fundamentals", "TCP/IP Model", "OSI Model", "DNS", "HTTP Protocol",
  "Software Design Patterns", "SOLID Principles", "Clean Architecture", "Domain Driven Design",
  "Agile Methodology", "Scrum", "Kanban", "DevOps Culture", "Site Reliability Engineering",
  "Web Assembly", "Progressive Web Apps", "Service Workers", "Browser Storage",
  "OAuth 2.0", "JWT Tokens", "OpenID Connect", "SAML", "API Gateway",
  "CI/CD Pipelines", "Blue Green Deployment", "Canary Releases", "Feature Flags",
  "Distributed Systems", "CAP Theorem", "ACID Properties", "BASE Model", "Eventual Consistency",
  "Apache Kafka", "RabbitMQ", "Apache Pulsar", "NATS Messaging", "ZeroMQ",
  "Prometheus Monitoring", "Grafana Dashboards", "OpenTelemetry", "Jaeger Tracing",
  "Nginx Web Server", "Apache HTTP Server", "Caddy Server", "Traefik Proxy",
  "Photosynthesis", "Cell Biology", "DNA Replication", "Protein Synthesis", "Evolution Theory",
  "General Relativity", "Quantum Mechanics", "Thermodynamics", "Electromagnetism",
  "Ancient Rome", "Ancient Greece", "Renaissance Period", "Industrial Revolution",
  "World War I", "World War II", "Cold War", "Space Race",
  "Climate Change", "Renewable Energy", "Solar Power", "Wind Energy", "Hydrogen Fuel",
  "Economic Theory", "Supply and Demand", "Keynesian Economics", "Monetary Policy",
  "Philosophy of Mind", "Ethics in Technology", "Logic and Reasoning", "Epistemology",
  "Music Theory", "Jazz History", "Classical Composers", "Electronic Music",
  "Cinema History", "Film Noir", "Documentary Filmmaking", "Animation Techniques",
  "Architecture Styles", "Bauhaus Movement", "Art Deco", "Modernism in Art",
  "Psychology Fundamentals", "Cognitive Behavioral Therapy", "Neuroscience Basics",
  "Nutrition Science", "Exercise Physiology", "Sleep Science", "Stress Biology",
  "International Law", "Human Rights", "Constitutional Law", "Environmental Law",
  "Statistics Fundamentals", "Probability Theory", "Linear Algebra", "Calculus",
  "Game Theory", "Operations Research", "Mathematical Optimization", "Control Theory",
  "Astronomy", "Black Holes", "Exoplanets", "Dark Matter", "Cosmic Microwave Background",
  "Genetics", "CRISPR Technology", "Bioinformatics", "Proteomics", "Epigenetics",
  "Sociology", "Anthropology", "Cultural Studies", "Media Studies",
  "Robotics", "Computer Aided Design", "3D Printing", "CNC Machining",
  "Electric Vehicles", "Autonomous Driving", "Battery Technology", "Hyperloop",
  "Virtual Reality", "Augmented Reality", "Mixed Reality", "Spatial Computing",
];

const TAGS_POOL = [
  "mongodb", "api-design", "backend", "frontend", "database", "nosql", "sql",
  "javascript", "python", "typescript", "nodejs", "docker", "kubernetes", "devops",
  "microservices", "rest", "graphql", "security", "authentication", "performance",
  "caching", "messaging", "streaming", "machine-learning", "ai", "data-science",
  "guide", "tutorial", "reference", "overview", "advanced", "beginner",
  "architecture", "design-patterns", "testing", "monitoring", "logging",
  "cloud", "aws", "gcp", "azure", "serverless", "containers",
  "science", "history", "technology", "programming", "networking", "distributed",
];

const AUTHORS = [
  { id: "user-001", name: "Alice Johnson", email: "alice@wiki.example.com" },
  { id: "user-002", name: "Bob Smith", email: "bob@wiki.example.com" },
  { id: "user-003", name: "Carol White", email: "carol@wiki.example.com" },
  { id: "user-004", name: "David Brown", email: "david@wiki.example.com" },
  { id: "user-005", name: "Eve Davis", email: "eve@wiki.example.com" },
  { id: "user-006", name: "Frank Miller", email: "frank@wiki.example.com" },
  { id: "user-007", name: "Grace Wilson", email: "grace@wiki.example.com" },
  { id: "user-008", name: "Henry Moore", email: "henry@wiki.example.com" },
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateContent(topic) {
  const paragraphs = [
    `## Introduction to ${topic}\n\n${topic} is a fundamental concept in modern technology and science. Understanding it requires familiarity with several underlying principles and practical applications that have evolved over decades of research and development.`,
    `## Historical Background\n\nThe origins of ${topic} can be traced back to pioneering work done in academic institutions and research laboratories. Early contributors laid the groundwork that would eventually lead to the sophisticated implementations we see today.`,
    `## Core Principles\n\nAt the heart of ${topic} lie several core principles:\n\n1. **Abstraction**: Breaking complex problems into manageable components.\n2. **Modularity**: Building systems from interchangeable parts.\n3. **Scalability**: Designing for growth and increased demand.\n4. **Reliability**: Ensuring consistent and correct operation under varying conditions.`,
    `## Practical Applications\n\n${topic} finds applications across many domains including enterprise software, scientific computing, data analysis, and consumer applications. Organizations worldwide leverage its capabilities to solve real-world problems efficiently.`,
    `## Implementation Considerations\n\nWhen implementing solutions based on ${topic}, practitioners must consider performance requirements, maintenance overhead, team expertise, and integration with existing systems. A thorough analysis of trade-offs is essential.`,
    `## Best Practices\n\nIndustry experts recommend following established best practices when working with ${topic}. Documentation, testing, and iterative development are cornerstone practices that lead to successful outcomes.`,
    `## Future Directions\n\nResearch in ${topic} continues to advance rapidly. Emerging trends suggest that future developments will bring improved efficiency, broader applicability, and tighter integration with adjacent technologies.`,
    `## Conclusion\n\n${topic} represents a significant area of knowledge that continues to evolve. Staying current with developments requires continuous learning and engagement with the broader community of practitioners and researchers.`,
  ];
  return paragraphs.join("\n\n");
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function generateRevisionHistory(version, authorId) {
  const revisions = [];
  const numRevisions = Math.min(version, 20);
  const now = new Date();

  for (let v = version; v > Math.max(0, version - numRevisions); v--) {
    const daysAgo = (version - v + 1) * 3;
    const revDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    revisions.push({
      version: v,
      updatedAt: revDate,
      authorId: randomChoice(AUTHORS).id,
      contentDiff: `Updated content in revision ${v}: refined explanation and added examples.`,
    });
  }
  return revisions;
}

async function ensureIndexes(collection) {
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex(
    { title: "text", content: "text" },
    { weights: { title: 10, content: 1 }, name: "text_search" }
  );
  await collection.createIndex({ tags: 1 });
  await collection.createIndex({ "metadata.updatedAt": -1 });
  console.log("[Seed] Indexes ensured.");
}

async function seedDatabase() {
  const db = getDB();
  const collection = db.collection("documents");

  // Always ensure indexes exist (idempotent)
  await ensureIndexes(collection);

  // Check if already seeded
  const count = await collection.countDocuments();
  if (count >= 1000) {
    console.log(`[Seed] Collection already has ${count} documents. Skipping seed.`);
    return;
  }

  console.log("[Seed] Starting database seeding...");

  const TOTAL_DOCS = 10000;
  const BATCH_SIZE = 500;
  const OLD_SCHEMA_RATIO = 0.1; // 10% old schema

  const usedSlugs = new Set();
  let inserted = 0;

  for (let batch = 0; batch < TOTAL_DOCS / BATCH_SIZE; batch++) {
    const docs = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const docIndex = batch * BATCH_SIZE + i;
      const topicIndex = docIndex % TOPICS.length;
      const variant = Math.floor(docIndex / TOPICS.length);

      const baseTopic = TOPICS[topicIndex];
      const title = variant === 0 ? baseTopic : `${baseTopic} - Part ${variant + 1}`;
      const content = generateContent(baseTopic);
      const tags = randomSubset(TAGS_POOL, 2, 5);
      const version = 1 + Math.floor(Math.random() * 25);
      const author = randomChoice(AUTHORS);
      const isOldSchema = Math.random() < OLD_SCHEMA_RATIO;

      // Generate unique slug
      let slug = generateSlug(title);
      let slugAttempt = 0;
      while (usedSlugs.has(slug)) {
        slugAttempt++;
        slug = `${generateSlug(title)}-${slugAttempt}`;
      }
      usedSlugs.add(slug);

      const now = new Date();
      const createdAt = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(createdAt.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);

      const doc = {
        slug,
        title,
        content,
        version,
        tags,
        metadata: {
          // Old schema: author is a string; New schema: author is an object
          author: isOldSchema
            ? author.name
            : { id: author.id, name: author.name, email: author.email },
          createdAt,
          updatedAt,
          wordCount: countWords(content),
        },
        revision_history: generateRevisionHistory(version, author.id),
      };

      docs.push(doc);
    }

    try {
      const result = await collection.insertMany(docs, { ordered: false });
      inserted += result.insertedCount;
    } catch (err) {
      // BulkWriteError: some documents may still have been inserted
      if (err.result && err.result.insertedCount) {
        inserted += err.result.insertedCount;
      } else if (err.insertedCount) {
        inserted += err.insertedCount;
      }
    }

    if ((batch + 1) % 4 === 0) {
      console.log(`[Seed] Progress: ${inserted}/${TOTAL_DOCS} documents inserted...`);
    }
  }

  const finalCount = await collection.countDocuments();
  console.log(`[Seed] Complete. Total documents in collection: ${finalCount}`);
}

module.exports = { seedDatabase };
