/**
 * Concurrency Test Script
 * 
 * This script fires 10 simultaneous requests to the reservation API for 
 * the exact same item. It proves that our pessimistic locking strategy 
 * correctly allows only 1 success while the others fail with 409.
 * 
 * Usage: 
 * 1. Run your server (npm run dev)
 * 2. In another terminal: node scripts/test-concurrency.js
 */

async function runTest() {
  const BASE_URL = 'http://localhost:3000/api';
  
  console.log('--- STARTING CONCURRENCY TEST ---');
  
  // 1. Find the Limited Edition product
  console.log('Fetching products...');
  const productsRes = await fetch(`${BASE_URL}/products`);
  const products = await productsRes.json();
  const targetProduct = products.find(p => p.name.includes('LIMITED EDITION'));

  if (!targetProduct || !targetProduct.stocks[0]) {
    console.error('Error: "LIMITED EDITION" product not found. Did you run the latest seed?');
    return;
  }

  const { id: productId } = targetProduct;
  const { warehouseId } = targetProduct.stocks[0];

  console.log(`Target SKU Found: ${targetProduct.name}`);
  console.log(`Available stock: ${targetProduct.stocks[0].availableUnits} unit(s)`);
  console.log(`Firing 10 simultaneous reservation requests...`);

  // 2. Fire 10 simultaneous requests
  const requests = Array.from({ length: 10 }).map((_, i) => 
    fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, warehouseId, quantity: 1 })
    })
  );

  const responses = await Promise.all(requests);
  
  // 3. Analyze Results
  let successes = 0;
  let conflicts = 0;
  let others = 0;

  for (const res of responses) {
    if (res.status === 201) successes++;
    else if (res.status === 409) conflicts++;
    else others++;
  }

  console.log('\n--- RESULTS ---');
  console.log(`Success (201 Created):  ${successes}`);
  console.log(`Conflict (409 Blocked): ${conflicts}`);
  console.log(`Other Responses:        ${others}`);

  if (successes === 1) {
    console.log('\n✅ TEST PASSED: Exactly 1 reservation succeeded despite heavy concurrency.');
  } else if (successes > 1) {
    console.log('\n❌ TEST FAILED: Race condition detected! Multiple users reserved the same unit.');
  } else {
    console.log('\n⚠️ TEST INCONCLUSIVE: Check if stock was already depleted.');
  }
}

runTest();
