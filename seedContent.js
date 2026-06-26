/**
 * seed.js — run once to populate default content blocks
 * Usage: node seed/seedContent.js
 *
 * Safe to re-run: uses upsert so it won't duplicate or overwrite manual edits
 * unless you change OVERWRITE to true.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Content = require("../models/Content");

const OVERWRITE = false; // set true to force-reset all blocks to defaults

const defaults = [
  {
    key: "hero",
    data: {
      eyebrow: "Venny Construction & Real Estate Co. Ltd.",
      headingLine1: "Maisha Ni",
      headingAccent: "Nyumba Bora",
      headingLine3: "in Tanzania",
      subheading:
        "From oceanfront villas in Zanzibar to city apartments in Dar es Salaam — discover exceptional properties built and trusted by Venny Construction & Real Estate.",
      searchPlaceholder: "Search by city or neighbourhood...",
      scrollLabel: "SCROLL",
      decorativeWord1: "Nyumba",
      decorativeWord2: "Bora",
      backgroundImage: "/featured/f7.jpeg",
    },
  },
  {
    key: "stats",
    data: {
      items: [
        { num: "1,200+", label: "Properties Listed" },
        { num: "850+",   label: "Happy Clients" },
        { num: "15+",    label: "Years Experience" },
      ],
    },
  },
  {
    key: "whyus",
    data: {
      eyebrow: "Why Venny Construction",
      heading: "The Trusted Way to Buy & Sell in Tanzania",
      cards: [
        {
          icon: "Shield",
          title: "Verified Listings",
          desc: "Every property is physically inspected and legally verified before appearing on our platform. No surprises.",
        },
        {
          icon: "Users",
          title: "Expert Local Agents",
          desc: "Our bilingual agents (Swahili & English) understand Tanzania's property market better than anyone.",
        },
        {
          icon: "TrendingUp",
          title: "Market Intelligence",
          desc: "Access real price data, neighbourhood insights, and investment analysis to make confident decisions.",
        },
      ],
    },
  },
  {
    key: "cta",
    data: {
      eyebrow: "Own Property in Tanzania?",
      heading: "List With Venny\n& Reach Thousands",
      subheading:
        "Connect with verified buyers and renters across Tanzania and the diaspora. Free listing for first 30 days.",
      buttonLabel: "List Your Property Free",
      buttonHref: "/contact",
      backgroundImage:
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1400&q=80",
    },
  },
  {
    key: "featured",
    data: {
      eyebrow: "Handpicked for You",
      heading: "Featured Properties",
      viewAllLabel: "View All Properties",
    },
  },
  {
    key: "locations",
    data: {
      eyebrow: "Explore Tanzania",
      heading: "Properties by Destination",
    },
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const block of defaults) {
    if (OVERWRITE) {
      await Content.findOneAndUpdate({ key: block.key }, block, { upsert: true });
      console.log(`✓ Overwrote "${block.key}"`);
    } else {
      const exists = await Content.findOne({ key: block.key });
      if (exists) {
        console.log(`– Skipped "${block.key}" (already exists)`);
      } else {
        await Content.create(block);
        console.log(`✓ Created "${block.key}"`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});