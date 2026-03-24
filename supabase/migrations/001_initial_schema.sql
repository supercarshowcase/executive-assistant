-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brokerage TEXT,
  city TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  context_note TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('buyer', 'seller')),
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'active', 'under_contract', 'closed', 'dead')),
  notes TEXT,
  last_contact_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  source_email_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_address TEXT NOT NULL,
  client_name TEXT NOT NULL,
  contract_date TIMESTAMPTZ,
  option_period_end TIMESTAMPTZ,
  closing_date TIMESTAMPTZ,
  lender_contact TEXT,
  title_company_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'option_period', 'pending_financing', 'clear_to_close', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Content library table
CREATE TABLE IF NOT EXISTS content_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  body TEXT NOT NULL,
  is_new BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Follow-up reminders table
CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  email_id TEXT,
  scheduled_date TIMESTAMPTZ NOT NULL,
  draft_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email triage cache table
CREATE TABLE IF NOT EXISTS email_triage_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT,
  suggested_action TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gmail_id, account_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_triage_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for email_accounts table
CREATE POLICY "Users can read own email accounts"
  ON email_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email accounts"
  ON email_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
  ON email_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
  ON email_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for leads table
CREATE POLICY "Users can read own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for transactions table
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for follow_up_reminders table
CREATE POLICY "Users can read own follow-ups"
  ON follow_up_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follow-ups"
  ON follow_up_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow-ups"
  ON follow_up_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own follow-ups"
  ON follow_up_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for email_triage_cache table
CREATE POLICY "Users can read own triage cache"
  ON email_triage_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own triage cache"
  ON email_triage_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own triage cache"
  ON email_triage_cache FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy for content_library (public read, admin insert)
CREATE POLICY "Anyone can read content library"
  ON content_library FOR SELECT
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_follow_up_date ON leads(follow_up_date);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_closing_date ON transactions(closing_date);
CREATE INDEX idx_follow_up_reminders_user_id ON follow_up_reminders(user_id);
CREATE INDEX idx_follow_up_reminders_scheduled_date ON follow_up_reminders(scheduled_date);
CREATE INDEX idx_follow_up_reminders_status ON follow_up_reminders(status);
CREATE INDEX idx_email_triage_cache_user_id ON email_triage_cache(user_id);
CREATE INDEX idx_email_triage_cache_account_id ON email_triage_cache(account_id);
CREATE INDEX idx_email_triage_cache_gmail_id ON email_triage_cache(gmail_id);

-- Insert seed data into content_library
INSERT INTO content_library (title, category, tags, body, is_new) VALUES
(
  'First-Time Home Buyer Guide',
  'buyer_education',
  ARRAY['buying', 'first-time', 'tips'],
  'Welcome to homeownership! This comprehensive guide covers everything first-time buyers need to know: getting pre-approved, understanding the mortgage process, home inspections, closing costs, and more. Key steps include: 1) Get pre-approved for a mortgage to understand your budget, 2) Find a real estate agent who specializes in first-time buyers, 3) Begin your property search with realistic criteria, 4) Make an offer when you find the right home, 5) Get a professional home inspection, 6) Finalize your mortgage and review closing documents, 7) Schedule a final walkthrough before closing. Don''t forget about important costs like down payment (3-20%), closing costs (2-5%), and home inspection fees ($300-700). Many first-time buyer programs offer down payment assistance. Let us help you find your dream home!',
  TRUE
),
(
  'Preparing Your Home for Sale',
  'seller_tips',
  ARRAY['selling', 'staging', 'preparation'],
  'Ready to sell? Preparing your home properly can significantly increase its value and appeal to buyers. Start with curb appeal: fresh paint on the front door, landscaping, clean walkways, and updated house numbers make great first impressions. Inside, declutter and depersonalize—buyers need to envision themselves in the home. Deep clean every surface, repair visible damage, and consider neutral paint colors. Stage key rooms like the living room and master bedroom with attractive furniture to show potential. Take professional photos in good lighting. Finally, get a pre-inspection to identify issues before buyers do. Studies show well-prepared homes sell 5-10% faster and for higher prices. Our team can guide you through each step to maximize your home''s market value.',
  TRUE
),
(
  'Understanding Real Estate Contracts',
  'legal_guides',
  ARRAY['contracts', 'legal', 'offers'],
  'Real estate contracts are binding legal documents that protect both buyers and sellers. Key terms to understand include: Offer Price (purchase amount), Contingencies (conditions that must be met), Earnest Money Deposit (good faith money), Inspection Period (time to conduct home inspection), Appraisal Contingency (if home appraises below offer price), Financing Contingency (subject to mortgage approval), Closing Date (when ownership transfers), and Seller Concessions (what seller will pay). Common contingencies protect buyers from unforeseen issues. Never sign without understanding all terms. Title insurance is crucial—it protects your ownership claim. Most contracts include a financing contingency protecting the buyer if loan approval fails, and an inspection period allowing time to discover issues. The contract should clearly state who pays for repairs, prorations of utilities, and all closing costs. Always have an attorney review before signing.',
  TRUE
),
(
  'Investment Property Analysis',
  'investment_guide',
  ARRAY['investing', 'analysis', 'returns'],
  'Investing in real estate can build long-term wealth through appreciation and rental income. Before purchasing an investment property, analyze key metrics: Cash Flow (monthly rental income minus expenses), Cap Rate (annual net income divided by property price, target 5-15%), Cash-on-Cash Return (annual cash flow divided by cash invested), and Debt Service Coverage Ratio (rental income divided by mortgage payment, must be 1.25+). Location matters—properties in growing markets appreciate faster. Consider property condition, tenant-ability, and local rent rates. Calculate all expenses: mortgage, property taxes, insurance, maintenance (plan 1% of property value annually), and property management (8-12% of rent). Screen tenants carefully to minimize vacancies. Most successful investors focus on one market initially to build expertise. Long-term wealth comes from holding quality properties through market cycles.',
  FALSE
),
(
  'Closing Day Checklist',
  'closing_guide',
  ARRAY['closing', 'checklist', 'final'],
  'Closing day is the final step in buying or selling a home. Make sure you''re prepared: Review all closing documents 1-2 days before signing—check loan terms, title information, and closing costs match the Closing Disclosure. Get a final walkthrough to ensure promised repairs are complete and the property is in agreed condition. Verify that the earnest money deposit and any other funds have been applied to closing costs. Have homeowners insurance in place with proof of coverage. Bring valid ID and check that your signature style matches loan documents. Prepare a cashier''s check for your down payment (most lenders won''t accept personal checks). Understand the title transfer process and whether you''re taking title as individuals, a trust, or an LLC. Ask your title company to explain any liens or unusual terms. After signing, you''ll receive the keys! Congratulations on your new property.',
  TRUE
);

-- Grant permissions to anon and service roles for content_library public read
GRANT SELECT ON content_library TO anon;
GRANT ALL ON content_library TO service_role;

-- Grant permissions to users and service roles
GRANT SELECT, INSERT, UPDATE ON users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON follow_up_reminders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_triage_cache TO service_role;
