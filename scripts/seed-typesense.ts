import { initializeTypesense } from '../src/lib/typesense'

async function main() {
  console.log('Initializing Typesense collection...')
  try {
    await initializeTypesense()
    console.log('Typesense collection initialized successfully')
  } catch (error) {
    console.error('Error initializing Typesense:', error)
    process.exit(1)
  }
}

main()