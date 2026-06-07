# 🚀 Business Brokerage Listings Scraper

A sophisticated TypeScript-based web scraping system designed to collect business-for-sale listings from multiple brokerage platforms. Built for high-reliability production use with intelligent error handling, automated notifications, and AWS-native infrastructure.

## 🎯 Project Overview

This scraper monitors **26+ business brokerage websites** to collect real-time business listings, providing automated alerts for new opportunities and comprehensive error reporting for system maintenance.

### Key Features

- 🔄 **Multi-Strategy Scraping**: Browser automation, API integration, and human simulation
- 📧 **Smart Notifications**: Email alerts for new listings and detailed error reports  
- 🛡️ **Intelligent Error Handling**: Automatic error classification with actionable insights
- ☁️ **AWS-Native**: Production deployment on Fargate with S3/SES integration
- 🐳 **Docker-Ready**: Containerized deployment with development environments
- 📊 **Comprehensive Monitoring**: CloudWatch logging with direct investigation links

## 🏗️ Architecture

### Scraping Strategies

The system supports three distinct scraping approaches:

#### 1. **Paginated Strategy** (Most Common)
- Pre-computes page URLs to visit
- Handles pagination automatically
- Concurrent processing of multiple pages
- Used by 20+ sites including BizBuySell, SunbeltNetwork, TheCBAGroup, etc.

#### 2. **API Strategy** 
- Direct API calls when available
- GraphQL and REST API support
- Most efficient and reliable method
- Used by: BatonMarket (GraphQL), TWorld

#### 3. **Human Strategy**
- Simulates human navigation (click next, scroll)
- Used when page URLs cannot be pre-computed
- Framework ready for implementations

### Core Components

```
src/
├── adapters/          # 26+ site-specific scrapers
├── core/
│   ├── scrape.ts      # Main orchestrator (ScrapeHandle)
│   ├── browser/       # Playwright management
│   ├── storage/       # S3 and Memory storage
│   ├── notify/        # Email notification system
│   └── models/       # Data models and error handling
├── config/           # Configuration management
└── index.ts          # Application entry point
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- TypeScript
- Docker (for local development)
- AWS CLI (for production deployment)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd scrapy-brokers-poc

# Install dependencies
npm install

# Install browser dependencies
npm run install-browser

# Copy configuration template
cp config/example.config.json config/local.config.json
```

### Development

```bash
# Local development with dry run
npm run dev

# Debug mode with verbose logging
npm run debug

# Docker development with local config
npm run docker-dev-local
```

### Production

```bash
# Build production image
docker build -t scrapy-brokers-poc .

# Deploy to AWS Fargate
aws cloudformation deploy \
  --template-file infra/fargate-task-chromium.yaml \
  --stack-name scrapy-brokers-poc
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CONFIG_PATH` | Path to configuration file | `./config/scrape.config.json` |
| `DRY_RUN` | Enable/disable dry run mode | `true` (local), `false` (production) |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Configuration Structure

```json
{
  "dryRun": false,
  "notifications": {
    "admin": "admin@example.com",
    "sender": "noreply@example.com",
    "to": ["user@example.com", "alerts@example.com"]
  },
  "database": {
    "type": "s3",
    "bucket": "scraping-data-bucket",
    "dataKey": "listings.json"
  },
  "scraper": {
    "sites": ["BizBuySell", "SunbeltNetwork", "BatonMarket"],
    "concurrency": 3,
    "browserOptions": {
      "headless": true,
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  }
}
```

### Supported Sites

The system supports 26+ business brokerage platforms:

**Browser Automation (Paginated):**
- BizBuySell, TheDynastyBA, SunbeltNetwork, TheCBAGroup
- VRBusinessBrokers, FCBB, VikingMergers, BeaconAdvisors
- Midstreet, BAMA, MorganWestfield, PronovaPartners
- And 10+ more...

**API Integration:**
- BatonMarket (GraphQL)
- TWorld (REST API)

## 📧 Notification System

### New Listing Alerts
- HTML email templates with listing details
- Automatic deduplication to prevent spam
- Direct links to source listings
- Site attribution and metadata

### Error Reporting
- **Intelligent Classification**: Errors categorized by likely cause:
  - `SiteStructureChanged`: DOM/selector issues (needs attention)
  - `AuthenticationFailure`: Access denied/blocked (needs attention)
  - `NetworkError`: Timeouts (may resolve automatically)
  - `RateLimitError`: Rate limiting (may resolve automatically)
  - And 6+ other categories...

- **Rich Email Reports**:
  - Error summaries and affected sites
  - Color-coded by severity
  - CloudWatch integration with direct log links
  - Investigation steps and recommendations

- **CloudWatch Integration**:
  - Structured logging with Pino
  - 14-day log retention
  - Direct links from error emails
  - Production monitoring and alerting

## ☁️ AWS Infrastructure

### Production Stack

**Compute:**
- AWS Fargate (serverless containers)
- 2 CPU, 4GB RAM per task
- Public IP assignment
- Multi-AZ deployment

**Storage:**
- S3 for persistent data storage
- Automatic deduplication
- JSON format with schema validation

**Notifications:**
- AWS SES for email delivery
- HTML and plain text templates
- Production and development modes

**Monitoring:**
- CloudWatch Logs aggregation
- 14-day retention
- Structured JSON logging
- Error-based alerting

### Deployment

**Scheduled Execution:**
- Daily at 6:00 PM EST via EventBridge
- Automatic retry on failure
- Graceful error handling per site

**Infrastructure as Code:**
- CloudFormation templates in `infra/`
- Automated CI/CD pipeline
- Environment-specific deployments

## 🛠️ Development

### Project Structure

```
src/
├── adapters/              # Site-specific scraping logic
│   ├── base.ts           # Base interfaces and types
│   ├── bizbuysell.ts     # Individual site adapters
│   └── ...               # 25+ more adapters
├── core/
│   ├── scrape.ts          # Main orchestrator
│   ├── browser/
│   │   ├── runner.ts     # Browser pool management
│   │   └── page.ts      # Individual page handling
│   ├── storage/
│   │   ├── s3.ts         # S3 storage backend
│   │   └── memory.ts     # In-memory for development
│   ├── notify/
│   │   ├── base.ts       # Template management
│   │   ├── ses.ts        # AWS SES notifier
│   │   └── local.ts      # Console notifier
│   ├── models/
│   │   ├── listing.ts    # Listing data model
│   │   └── error.ts      # Error classification
│   └── config/           # Configuration management
├── templates/            # Handlebars email templates
├── config/              # Configuration files
├── infra/               # CloudFormation templates
└── dist/                # Compiled JavaScript
```

### Adding New Sites

1. **Create Adapter**: Extend `BasePageObjectPaginated`, `BaseApiObject`, or `BasePageObjectHuman`
2. **Implement Methods**: Add site-specific scraping logic
3. **Register Site**: Add to configuration and adapters index
4. **Test**: Use `npm run dev` with dry run mode

### Error Handling

The system includes comprehensive error handling:

```typescript
// Automatic error classification
const error = ErrorClassifier.createScrapingError(err, site, url);

// Error types include:
// - SiteStructureChanged (needs attention)
// - AuthenticationFailure (needs attention)  
// - NetworkError (may resolve automatically)
// - RateLimitError (may resolve automatically)
// - And 6+ more categories
```

## 🐳 Docker Support

### Development Container

```dockerfile
# Multi-stage build with Playwright
FROM node:18-alpine as builder
# Build TypeScript...

FROM mcr.microsoft.com/playwright:v1.40.0-focal
# Copy built application and dependencies...
```

### Running with Docker

```bash
# Local development
docker run -e DRY_RUN=true -e CONFIG_PATH=./config/local.config.json scrapy-brokers-poc

# Production simulation  
docker run -e CONFIG_PATH=./config/prod.config.json scrapy-brokers-poc
```

## 📊 Monitoring & Debugging

### Logging

All logs are structured with Pino:

```json
{
  "level": "info",
  "time": "2024-01-16T12:00:00.000Z",
  "pid": 1,
  "hostname": "scraper",
  "component": "BrowserRunner",
  "site": "BizBuySell",
  "listingsFound": 15,
  "msg": "Listings found"
}
```

### CloudWatch Integration

- **Log Groups**: `/aws/lambda/scrapy-brokers-poc`
- **Retention**: 14 days
- **Search**: Full-text search and filtering
- **Alerts**: Error-based notifications
- **Integration**: Direct links from error emails

### Performance Metrics

The system provides detailed performance tracking:

- **Scrape Duration**: Total time for all sites
- **Site Performance**: Per-site execution times
- **Error Rates**: Error frequency and types
- **Success Rates**: Successful listings vs. failures

## 🤝 Contributing

### Development Workflow

1. **Setup**: Install dependencies and browser
2. **Develop**: Add features or fix bugs
3. **Test**: `npm run dev` and `npm run test`
4. **Lint**: Automatic pre-commit hooks
5. **Deploy**: CloudFormation updates

### Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code style enforcement
- **Prettier**: Consistent formatting
- **Husky**: Pre-commit hooks
- **Zod**: Runtime configuration validation

## 📝 License

This is a proprietary project for Blue Oak Holdings (BOH). All rights reserved.

## 🆘 Support

For issues or questions:

1. **Check CloudWatch Logs**: Use links from error emails
2. **Review Configuration**: Validate site settings and credentials
3. **Monitor Sites**: Manual verification of site changes
4. **Contact Admin**: Use configured notification email

## 🔄 Version History

- **v1.0.0**: Initial production deployment with 26+ sites
- **v1.1.0**: Added intelligent error reporting and classification
- **v1.2.0**: Enhanced CloudWatch integration and email templates