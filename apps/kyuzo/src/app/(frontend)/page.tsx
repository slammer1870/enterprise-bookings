import PageTemplate, { generateMetadata } from './[slug]/page'

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic'

export default PageTemplate

export { generateMetadata }
