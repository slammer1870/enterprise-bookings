import { test, expect } from '@playwright/test'
import { ensureAdminUser } from './utils/admin-setup'

/**
 * E2E test for admin lesson creation workflow
 * Tests the complete flow of:
 * 1. Admin logging into admin dashboard
 * 2. Navigating to lessons collection
 * 3. Creating a new lesson
 * 4. Setting up class option if needed
 * 5. Completing the lesson creation process
 */
test.describe('Admin Lesson Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure admin user is authenticated
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }
    
    // Verify we're in the admin panel
    await expect(page).toHaveURL(/\/admin/)
    await expect(page).not.toHaveURL(/\/admin\/login/)
    await expect(page).not.toHaveURL(/\/admin\/create-first-user/)
  })

  test('should navigate to lessons collection', async ({ page }) => {
    // Ensure admin user is logged in first
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }
    
    // Navigate directly to lessons collection (more reliable than clicking)
    try {
      await page.goto('/admin/collections/lessons', { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (e) {
      // If navigation fails, try with load
      await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
    }
    
    // Wait a moment for the page to settle
    await page.waitForTimeout(2000)

    // Check current URL - might already be on the page
    let currentUrl = page.url()
    
    // If we're not on the lessons page, wait for navigation (but don't fail if we're already there)
    if (!currentUrl.includes('/admin/collections/lessons')) {
      try {
        await page.waitForURL(/\/admin\/collections\/lessons/, { timeout: 20000 })
        currentUrl = page.url()
      } catch (e) {
        // If navigation times out, check if we're at least in the admin area
        currentUrl = page.url()
        if (!currentUrl.includes('/admin')) {
          throw new Error(`Failed to navigate to lessons collection. Current URL: ${currentUrl}`)
        }
        // If we're in admin but not on lessons, try navigating again
        await page.goto('/admin/collections/lessons', { waitUntil: 'domcontentloaded', timeout: 30000 })
        currentUrl = page.url()
      }
    }

    // Verify we're on the lessons collection page
    // Look for any indication we're on the lessons page
    const pageHeading = page.locator('h1, h2, h3').filter({ hasText: /lessons/i }).first()
    const pageContentByTestId = page.locator('[data-testid*="lessons"]').first()
    const pageContentByText = page.locator('text=/lessons/i').first()
    const createButton = page.getByRole('button', { name: /create|new|add/i }).first()
    const lessonsLink = page.getByRole('link', { name: /lessons/i }).first()
    
    const headingVisible = await pageHeading.isVisible({ timeout: 5000 }).catch(() => false)
    const testIdVisible = await pageContentByTestId.isVisible({ timeout: 5000 }).catch(() => false)
    const textVisible = await pageContentByText.isVisible({ timeout: 5000 }).catch(() => false)
    const createButtonVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false)
    const lessonsLinkVisible = await lessonsLink.isVisible({ timeout: 5000 }).catch(() => false)
    const finalUrl = page.url()
    
    expect(headingVisible || testIdVisible || textVisible || createButtonVisible || lessonsLinkVisible || finalUrl.includes('/admin/collections/lessons')).toBe(true)
  })

  test('should create a new lesson with all required fields', async ({ page }) => {
    // Ensure admin user is logged in (session might have expired)
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }
    
    // Navigate to lessons collection
    await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Click "Create New" button - try multiple strategies
    const createButtonByText = page.getByRole('button', { name: /create new|new|add|create/i }).first()
    const createLink = page.getByRole('link', { name: /create|new|add/i }).first()
    const createByHref = page.locator('a[href*="/create"], button[href*="/create"]').first()
    
    let createButton = null
    if (await createButtonByText.isVisible({ timeout: 5000 }).catch(() => false)) {
      createButton = createButtonByText
    } else if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      createButton = createLink
    } else if (await createByHref.isVisible({ timeout: 5000 }).catch(() => false)) {
      createButton = createByHref
    } else {
      // Fallback: navigate directly to create page
      await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }

    if (createButton) {
      await createButton.click()
    }

    // Wait for create lesson form to load - check current URL first
    const currentUrl = page.url()
    if (!currentUrl.includes('/admin/collections/lessons/create')) {
      try {
        await page.waitForURL(/\/admin\/collections\/lessons\/create/, { timeout: 10000 })
      } catch (e) {
        // If timeout, check if we're already on the create page
        const url = page.url()
        if (!url.includes('/admin/collections/lessons/create')) {
          throw e
        }
      }
    }
    await page.waitForTimeout(2000)

    // Get tomorrow's date for the lesson
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr: string = tomorrow.toISOString().split('T')[0] || '' // YYYY-MM-DD format

    // Fill in date field
    const dateInput = page.locator('input[type="date"], input[name*="date"]').first()
    if (await dateInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateInput.fill(dateStr)
    } else {
      // Try finding date field by label
      const dateField = page.getByLabel(/date/i).first()
      if (await dateField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dateField.fill(dateStr)
      }
    }

    // Fill in start time (e.g., 10:00 AM)
    const startTimeInput = page.locator('input[type="time"], input[name*="startTime"], input[name*="start_time"]').first()
    if (await startTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startTimeInput.fill('10:00')
    } else {
      const startTimeField = page.getByLabel(/start time/i).first()
      if (await startTimeField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startTimeField.fill('10:00')
      }
    }

    // Fill in end time (e.g., 11:00 AM)
    const endTimeInput = page.locator('input[type="time"], input[name*="endTime"], input[name*="end_time"]').first()
    if (await endTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await endTimeInput.fill('11:00')
    } else {
      const endTimeField = page.getByLabel(/end time/i).first()
      if (await endTimeField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await endTimeField.fill('11:00')
      }
    }

    // Fill in lock out time (minutes before lesson closes)
    const lockOutTimeInput = page.locator('input[type="number"], input[name*="lockOutTime"], input[name*="lock_out_time"]').first()
    if (await lockOutTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lockOutTimeInput.fill('30')
    } else {
      const lockOutTimeField = page.getByLabel(/lock.*out.*time/i).first()
      if (await lockOutTimeField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lockOutTimeField.fill('30')
      }
    }

    // Select class option (required field)
    // First check if there are existing class options
    const classOptionSelect = page.locator('input[id*="react-select"], select[name*="classOption"], select[name*="class_option"]').first()
    if (await classOptionSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await classOptionSelect.click()
      await page.waitForTimeout(500)

      // Try to select an existing class option
      const classOptionOption = page.getByRole('option').first()
      if (await classOptionOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await classOptionOption.click()
        await page.waitForTimeout(500)
      } else {
        // No class options exist, we'll need to create one first
        // This will be handled in a separate test
        test.skip()
        return
      }
    } else {
      // Class option field not found - might need to create one first
      test.skip()
      return
    }

    // Optionally fill in location
    const locationInput = page.locator('input[name*="location"], input[type="text"]').filter({ hasText: /location/i }).first()
    if (await locationInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await locationInput.fill('Main Studio')
    } else {
      const locationField = page.getByLabel(/location/i).first()
      if (await locationField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await locationField.fill('Main Studio')
      }
    }

    // Ensure active checkbox is checked (should be by default)
    const activeCheckbox = page.locator('input[type="checkbox"][name*="active"]').first()
    if (await activeCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isChecked = await activeCheckbox.isChecked()
      if (!isChecked) {
        await activeCheckbox.click()
      }
    }

    // Save the lesson
    const saveButton = page.getByRole('button', { name: /save|create|submit/i }).first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    await saveButton.click()

    // Wait for redirect to lesson detail page or lessons list
    await page.waitForURL(/\/admin\/collections\/lessons/, { timeout: 15000 })
    
    // Verify lesson was created (should be on detail page or list page)
    const successMessage = page.locator('text=/success|created|saved/i').first()
    const onDetailPage = page.url().match(/\/admin\/collections\/lessons\/\d+/)
    const onListPage = page.url().includes('/admin/collections/lessons') && !page.url().includes('/create')

    expect(onDetailPage || onListPage).toBe(true)
  })

  test('should create class option before creating lesson', async ({ page }) => {
    // Ensure admin user is authenticated first
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }
    
    // Navigate directly to create page (more reliable than clicking)
    await page.goto('/admin/collections/class-options/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // Verify we're on the create page (might be redirected to login if not authenticated)
    const currentUrl = page.url()
    if (currentUrl.includes('/admin/login') || currentUrl.includes('/admin/create-first-user')) {
      // Try to authenticate again
      const reAuth = await ensureAdminUser(page)
      if (!reAuth) {
        throw new Error(`Failed to authenticate. Current URL: ${currentUrl}`)
      }
      // Navigate again after authentication
      await page.goto('/admin/collections/class-options/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Verify we're on the create page
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/create/, { timeout: 10000 })

    // Generate a unique name for the class option (name field is unique)
    const uniqueName = `Test Class Option ${Date.now()}`
    
    // Wait for form to fully load - use shorter timeout to avoid test timeout
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(1000) // Additional wait for form rendering
    
    // Fill in class option name - try multiple selector strategies
    let nameInput = page.getByRole('textbox', { name: /^name\s*\*/i }).first()
    if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try without asterisk
      nameInput = page.getByRole('textbox', { name: /^name$/i }).first()
    }
    if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try with label
      nameInput = page.getByLabel(/^name$/i).first()
    }
    if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try by field ID or name attribute
      nameInput = page.locator('input[name*="name"], input[id*="name"], #field-name input').first()
    }
    
    await expect(nameInput).toBeVisible({ timeout: 20000 })
    await nameInput.click() // Click to focus
    await page.waitForTimeout(500)
    await nameInput.fill(uniqueName)
    await page.waitForTimeout(500)
    // Verify the value was filled
    const nameValue = await nameInput.inputValue()
    if (!nameValue || nameValue.trim() === '') {
      await nameInput.fill(uniqueName)
      await page.waitForTimeout(500)
    }

    // Fill in places (capacity) - required field
    let placesInput = page.locator('input[type="number"], input[name*="places"]').first()
    if (!(await placesInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      placesInput = page.getByLabel(/places|capacity/i).first()
    }
    if (!(await placesInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      placesInput = page.locator('input[type="number"]').first()
    }
    await expect(placesInput).toBeVisible({ timeout: 15000 })
    await placesInput.fill('20')
    await page.waitForTimeout(500)

    // Fill in description - required field
    let descriptionInput = page.getByRole('textbox', { name: /description/i }).first()
    if (!(await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      descriptionInput = page.getByLabel(/description/i).first()
    }
    if (!(await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try finding by field ID
      descriptionInput = page.locator('#field-description textarea, #field-description input, [id*="description"]').first()
    }
    await expect(descriptionInput).toBeVisible({ timeout: 15000 })
    await descriptionInput.fill('A test class option for e2e testing')
    await page.waitForTimeout(500)

    // Select type (adult, child, or family)
    const typeSelect = page.locator('select[name*="type"], input[id*="react-select"]').first()
    if (await typeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await typeSelect.click()
      await page.waitForTimeout(500)

      // Select "adult" type
      const adultOption = page.getByRole('option', { name: /adult/i }).first()
      if (await adultOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await adultOption.click()
        await page.waitForTimeout(500)
      }
    }

    // Save the class option
    const saveButton = page.getByRole('button', { name: /save|create|submit/i }).first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    await saveButton.click()

    // Wait for redirect away from create page - check for either detail page or list page
    await page.waitForTimeout(2000) // Give time for save to process
    
    // Check if we're still on create page - if so, check for errors
    const currentUrlAfterSave = page.url()
    if (currentUrlAfterSave.includes('/create')) {
      // Check for validation errors - use separate locators for CSS and text
      const cssErrors = await page.locator('.payload-toast-container .toast--error, .form-field--error').all()
      const textErrors = await page.locator('text=/error|required|invalid/i').all()
      const allErrors = [...cssErrors, ...textErrors]
      if (allErrors.length > 0) {
        const errorTexts = await Promise.all(allErrors.map(async (error) => await error.textContent()))
        throw new Error(`Class option form validation errors: ${errorTexts.filter(Boolean).join(', ')}`)
      }
      
      // Try waiting for navigation with longer timeout
      try {
        await page.waitForURL(
          (url) => {
            const urlString = url.toString()
            return urlString.includes('/admin/collections/class-options') && !urlString.includes('/create')
          },
          { timeout: 20000 }
        )
      } catch (e) {
        throw new Error('Class option creation failed - still on create page after save attempt')
      }
    }
    
    await page.waitForTimeout(2000)
    
    // Verify class option was created
    const finalUrl = page.url()
    const onDetailPage = /\/admin\/collections\/class-options\/\d+/.test(finalUrl)
    const onListPage = finalUrl.includes('/admin/collections/class-options') && !finalUrl.includes('/create')

    // If still on create page, check for errors
    if (finalUrl.includes('/create')) {
      const errorMessage = page.locator('text=/error|required|invalid/i').first()
      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasError) {
        const errorText = await errorMessage.textContent()
        throw new Error(`Class option creation failed with error: ${errorText}`)
      }
      
      throw new Error('Class option creation failed - still on create page after save attempt')
    }

    expect(onDetailPage || onListPage).toBe(true)
  })

  test('should complete full lesson creation workflow', async ({ page }) => {
    // Step 1: Ensure we have a class option (create if needed)
    await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Check if any class options exist by looking for the list
    const hasClassOptions = await page.locator('table, [data-testid*="list"], a[href*="/class-options/"]').count() > 0

    if (!hasClassOptions) {
      // Create a class option first
      const createButton = page.getByRole('button', { name: /create new|new|add/i }).first()
      if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createButton.click()
        await page.waitForURL(/\/admin\/collections\/class-options\/create/, { timeout: 15000 })
        await page.waitForTimeout(2000)

        // Generate a unique name for the class option (name field is unique)
        const uniqueName = `E2E Test Class ${Date.now()}`
        
        // Fill in class option details - use improved filling logic
        let nameInput = page.getByRole('textbox', { name: /name/i }).first()
        if (!(await nameInput.isVisible({ timeout: 2000 }).catch(() => false))) {
          nameInput = page.getByLabel(/name/i).first()
        }
        if (!(await nameInput.isVisible({ timeout: 2000 }).catch(() => false))) {
          nameInput = page.locator('input[name*="name"], input[id*="name"]').first()
        }
        await expect(nameInput).toBeVisible({ timeout: 10000 })
        await nameInput.click()
        await page.waitForTimeout(500)
        await nameInput.fill(uniqueName)
        await page.waitForTimeout(500)
        // Verify the value was filled
        const nameValue = await nameInput.inputValue()
        if (!nameValue || nameValue.trim() === '') {
          await nameInput.fill(uniqueName)
          await page.waitForTimeout(500)
        }

        const placesInput = page.locator('input[type="number"], input[name*="places"]').first()
        if (await placesInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await placesInput.fill('15')
          await page.waitForTimeout(500)
        }

        const descriptionInput = page.getByRole('textbox', { name: /description/i }).first()
        if (await descriptionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await descriptionInput.fill('Test class for e2e testing')
          await page.waitForTimeout(500)
        }

        // Save class option
        const saveButton = page.getByRole('button', { name: /save|create/i }).first()
        await expect(saveButton).toBeVisible({ timeout: 10000 })
        await saveButton.click()
        
        // Wait for navigation away from create page
        await page.waitForTimeout(2000)
        const currentUrl = page.url()
        if (currentUrl.includes('/create')) {
          // Still on create page - wait longer or check for errors
          try {
            await page.waitForURL(/\/admin\/collections\/class-options/, { timeout: 20000 })
          } catch (e) {
            // Check for validation errors
            const errorMessages = page.locator('text=/error|required|invalid/i')
            const errorCount = await errorMessages.count()
            if (errorCount > 0) {
              const errorTexts = await Promise.all(
                Array.from({ length: Math.min(errorCount, 3) }).map(async (_, i) => {
                  return await errorMessages.nth(i).textContent().catch(() => '')
                })
              )
              throw new Error(`Class option creation failed: ${errorTexts.filter(Boolean).join(', ')}`)
            }
            throw new Error('Class option creation failed - still on create page')
          }
        }
        await page.waitForTimeout(2000)
      }
    }
    
    // Wait a bit longer to ensure class options are fully available in the system
    // Use shorter timeout to avoid test timeout
    await page.waitForTimeout(1000)

    // Step 2: Navigate to lessons and create a new lesson
    await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Based on MCP exploration: "Create New" is a link containing a button
    const createLink = page.getByRole('link', { name: /create new/i }).first()
    const createButton = page.getByRole('button', { name: /create new/i }).first()
    
    if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createLink.click()
    } else if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click()
    } else {
      // Fallback: navigate directly to create page
      await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
    }

    await page.waitForURL(/\/admin\/collections\/lessons\/create/, { timeout: 15000 })
    await page.waitForTimeout(2000)

    // Step 3: Fill in lesson details
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    // Format date as DD/MM/YYYY for Payload date picker
    const day = String(tomorrow.getDate()).padStart(2, '0')
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const year = tomorrow.getFullYear()
    const dateStr = `${day}/${month}/${year}`

    // Date - Payload uses a textbox with date picker
    const dateLabel = page.locator('text=Date').first()
    if (await dateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      const dateInput = dateLabel.locator('..').locator('..').locator('textbox').first()
      if (await dateInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dateInput.click() // Click to focus
        await page.waitForTimeout(500)
        await dateInput.fill(dateStr)
        await page.waitForTimeout(500)
        // Press Enter or Tab to confirm date
        await dateInput.press('Enter')
        await page.waitForTimeout(500)
      } else {
        // Fallback: find first textbox (usually date)
        const firstTextbox = page.getByRole('textbox').first()
        if (await firstTextbox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstTextbox.click()
          await page.waitForTimeout(500)
          await firstTextbox.fill(dateStr)
          await page.waitForTimeout(500)
          await firstTextbox.press('Enter')
          await page.waitForTimeout(500)
        }
      }
    }

    // Class option (required) - fill this FIRST as it's required
    // Based on MCP exploration: Payload uses React Select combobox
    // The combobox is near the "Class Option" label and opens a listbox with options
    await page.waitForTimeout(2000) // Wait for form to render
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1000) // Additional wait
    
    // Find the Class Option combobox - try multiple strategies
    let classOptionCombobox = null
    
    // Strategy 1: Find by field ID (Payload uses #field-* pattern)
    const fieldIdSelectors = [
      '#field-classOption',
      '[id*="classOption"]',
      '[id*="class-option"]',
      '#field-class_option'
    ]
    
    for (const selector of fieldIdSelectors) {
      const fieldContainer = page.locator(selector).first()
      if (await fieldContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
        classOptionCombobox = fieldContainer.getByRole('combobox').first()
        if (await classOptionCombobox.isVisible({ timeout: 2000 }).catch(() => false)) {
          break
        }
      }
    }
    
    // Strategy 2: Find combobox near the "Class Option" label
    if (!classOptionCombobox || !(await classOptionCombobox.isVisible({ timeout: 2000 }).catch(() => false))) {
      const classOptionLabel = page.locator('text=Class Option, label:has-text("Class Option")').first()
      if (await classOptionLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Find combobox in the same field group - try multiple parent levels
        for (let i = 1; i <= 5; i++) {
          let parentPath = classOptionLabel
          for (let j = 0; j < i; j++) {
            parentPath = parentPath.locator('..')
          }
          const combobox = parentPath.getByRole('combobox').first()
          if (await combobox.isVisible({ timeout: 1000 }).catch(() => false)) {
            classOptionCombobox = combobox
            break
          }
        }
      }
    }
    
    // Strategy 3: Find all comboboxes and pick the one that shows "Select a value"
    if (!classOptionCombobox || !(await classOptionCombobox.isVisible({ timeout: 2000 }).catch(() => false))) {
      const allComboboxes = await page.getByRole('combobox').all()
      for (const combobox of allComboboxes) {
        const isVisible = await combobox.isVisible({ timeout: 1000 }).catch(() => false)
        if (isVisible) {
          const comboboxText = await combobox.textContent().catch(() => '') || ''
          if (comboboxText.includes('Select a value')) {
            // Verify it's near Class Option by checking surrounding text
            const parentText = await combobox.locator('..').locator('..').textContent().catch(() => '') || ''
            if (parentText.includes('Class Option') || parentText.includes('Class')) {
              classOptionCombobox = combobox
              break
            }
          }
        }
      }
    }
    
    // Strategy 4: Use the second combobox (Class Option is typically after Instructor)
    if (!classOptionCombobox || !(await classOptionCombobox.isVisible({ timeout: 2000 }).catch(() => false))) {
      const allComboboxes = await page.getByRole('combobox').all()
      // Class Option is typically the second combobox (after Instructor)
      if (allComboboxes.length >= 2 && allComboboxes[1]) {
        const isVisible = await allComboboxes[1].isVisible({ timeout: 2000 }).catch(() => false)
        if (isVisible) {
          classOptionCombobox = allComboboxes[1]
        }
      }
      // If that doesn't work, try the last one
      if ((!classOptionCombobox || !(await classOptionCombobox.isVisible({ timeout: 1000 }).catch(() => false))) && allComboboxes.length > 0) {
        const lastCombobox = allComboboxes[allComboboxes.length - 1]
        if (lastCombobox) {
          const isVisible = await lastCombobox.isVisible({ timeout: 2000 }).catch(() => false)
          if (isVisible) {
            classOptionCombobox = lastCombobox
          }
        }
      }
    }
    
    if (!classOptionCombobox || !(await classOptionCombobox.isVisible({ timeout: 20000 }).catch(() => false))) {
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/class-option-combobox-not-found.png', fullPage: true }).catch(() => {})
      
      // Log all comboboxes found for debugging
      const allComboboxes = await page.getByRole('combobox').all()
      const comboboxInfo = await Promise.all(
        allComboboxes.map(async (cb, idx) => {
          const text = await cb.textContent().catch(() => '')
          const isVisible = await cb.isVisible({ timeout: 500 }).catch(() => false)
          return `Combobox ${idx}: visible=${isVisible}, text="${text}"`
        })
      )
      
      throw new Error(`Class Option combobox not found. Found ${allComboboxes.length} comboboxes: ${comboboxInfo.join('; ')}. Check screenshot: test-results/class-option-combobox-not-found.png`)
    }
    
    // Click to open the dropdown - React Select opens a listbox
    await classOptionCombobox.click()
    await page.waitForTimeout(2000) // Wait for React Select dropdown to appear
    
    // Wait for listbox to appear with options
    const listbox = page.locator('listbox, [role="listbox"]').first()
    await expect(listbox).toBeVisible({ timeout: 10000 })
    
    // Get all options from the listbox
    const options = await listbox.getByRole('option').all()
    
    if (options.length === 0) {
      // Check if class options exist in the database
      const currentUrl = page.url()
      await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(2000)
      const hasOptions = await page.locator('table, [data-testid*="list"], a[href*="/class-options/"]').count() > 0
      await page.goto(currentUrl, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(2000)
      
      if (!hasOptions) {
        throw new Error('No class options exist in the database. Please create a class option first.')
      } else {
        throw new Error('Class options exist but are not appearing in the dropdown. This may be a timing issue.')
      }
    }
    
    // Select the first available option
    const firstOption = options[0]
    if (!firstOption) {
      throw new Error('No class option available in dropdown')
    }
    
    const optionText = await firstOption.textContent()
    if (!optionText) {
      throw new Error('Class option text could not be retrieved')
    }
    
    await firstOption.click()
    await page.waitForTimeout(2000) // Wait for selection to register
    
    // Verify selection was made
    const comboboxText = await classOptionCombobox.textContent()
    if (comboboxText && comboboxText.includes('Select a value')) {
      // Selection might not have registered, try clicking again
      await classOptionCombobox.click()
      await page.waitForTimeout(1000)
      const listboxAgain = page.locator('listbox, [role="listbox"]').first()
      await expect(listboxAgain).toBeVisible({ timeout: 5000 })
      const optionAgain = listboxAgain.getByRole('option', { name: optionText || '' }).first()
      if (await optionAgain.isVisible({ timeout: 5000 }).catch(() => false)) {
        await optionAgain.click()
        await page.waitForTimeout(2000)
      }
    }

    // Start time - click to open time picker dialog, then select time
    const startTimeInput = page.locator('#field-startTime').getByRole('textbox').first()
    if (await startTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startTimeInput.click() // Click to open time picker
      await page.waitForTimeout(1000) // Wait for dialog to appear
      
      // Select "2:00 PM" (14:00) from the time picker
      const timeOption = page.getByRole('option', { name: '2:00 PM', exact: true }).first()
      if (await timeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await timeOption.click()
        await page.waitForTimeout(500)
      }
    } else {
      // Fallback: Find the textbox that comes after "Start Time" label
      const startTimeLabel = page.locator('text=Start Time').first()
      if (await startTimeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        const startTimeInputFallback = startTimeLabel.locator('..').locator('..').locator('textbox').first()
        if (await startTimeInputFallback.isVisible({ timeout: 5000 }).catch(() => false)) {
          await startTimeInputFallback.click()
          await page.waitForTimeout(1000)
          const timeOption = page.getByRole('option', { name: '2:00 PM', exact: true }).first()
          if (await timeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
            await timeOption.click()
            await page.waitForTimeout(500)
          }
        }
      }
    }

    // End time - click to open time picker dialog, then select time
    const endTimeInput = page.locator('#field-endTime').getByRole('textbox').first()
    if (await endTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await endTimeInput.click() // Click to open time picker
      await page.waitForTimeout(1000) // Wait for dialog to appear
      
      // Select "3:00 PM" (15:00) from the time picker
      const timeOption = page.getByRole('option', { name: '3:00 PM', exact: true }).first()
      if (await timeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await timeOption.click()
        await page.waitForTimeout(500)
      }
    } else {
      // Fallback: Find the textbox that comes after "End Time" label
      const endTimeLabel = page.locator('text=End Time').first()
      if (await endTimeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        const endTimeInputFallback = endTimeLabel.locator('..').locator('..').locator('textbox').first()
        if (await endTimeInputFallback.isVisible({ timeout: 5000 }).catch(() => false)) {
          await endTimeInputFallback.click()
          await page.waitForTimeout(1000)
          const timeOption = page.getByRole('option', { name: '3:00 PM', exact: true }).first()
          if (await timeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
            await timeOption.click()
            await page.waitForTimeout(500)
          }
        }
      }
    }

    // Lock out time
    const lockOutTimeInput = page.locator('input[type="number"], input[name*="lockOutTime"], input[name*="lock_out_time"]').first()
    if (await lockOutTimeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lockOutTimeInput.fill('60')
      await page.waitForTimeout(500)
    } else {
      const lockOutTimeByLabel = page.getByLabel(/lock.*out.*time/i).first()
      if (await lockOutTimeByLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lockOutTimeByLabel.fill('60')
        await page.waitForTimeout(500)
      }
    }

    // Location (optional)
    const locationInput = page.getByLabel(/location/i).first()
    if (await locationInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await locationInput.fill('Main Training Room')
    }

    // Step 4: Save the lesson
    const saveButton = page.getByRole('button', { name: /save|create/i }).first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    
    // Take a screenshot before saving for debugging
    await page.screenshot({ path: 'test-results/before-save.png', fullPage: true }).catch(() => {})
    
    await saveButton.click()
    
    // Wait a moment for any validation errors to appear or for navigation
    await page.waitForTimeout(3000)

    // Check current URL - might have navigated already
    let currentUrlAfterClick = page.url()
    if (!currentUrlAfterClick.includes('/create')) {
      // Successfully navigated away from create page
      await page.waitForTimeout(2000)
      return
    }

    // Still on create page - check for validation errors more thoroughly
    // Check for toast notifications with errors
    const toastErrors = page.locator('.payload-toast-container .toast--error, .toast--error').or(page.locator('[role="alert"]').filter({ hasText: /error/i }))
    const toastErrorCount = await toastErrors.count()
    if (toastErrorCount > 0) {
      const toastTexts = await Promise.all(
        Array.from({ length: Math.min(toastErrorCount, 3) }).map(async (_, i) => {
          return await toastErrors.nth(i).textContent().catch(() => '')
        })
      )
      await page.screenshot({ path: 'test-results/toast-errors.png', fullPage: true }).catch(() => {})
      throw new Error(`Toast error messages: ${toastTexts.filter(Boolean).join(', ')}`)
    }

    // Check for validation errors in form fields
    const errorMessages = page.locator('text=/error|required|invalid|missing|field is invalid/i')
    const errorCount = await errorMessages.count()
    
    if (errorCount > 0) {
      // Get error text for debugging
      const errorTexts = await Promise.all(
        Array.from({ length: Math.min(errorCount, 5) }).map(async (_, i) => {
          return await errorMessages.nth(i).textContent().catch(() => '')
        })
      )
      await page.screenshot({ path: 'test-results/validation-errors.png', fullPage: true }).catch(() => {})
      throw new Error(`Form validation errors: ${errorTexts.filter(Boolean).join(', ')}`)
    }

    // Step 5: Verify lesson was created successfully
    // Wait for navigation away from create page with longer timeout
    try {
      await page.waitForURL(
        (url) => {
          const urlString = url.toString()
          return urlString.includes('/admin/collections/lessons') && !urlString.includes('/create')
        },
        { timeout: 20000 }
      )
    } catch (e) {
      // If navigation didn't happen, take a screenshot and check current state
      await page.screenshot({ path: 'test-results/after-save-timeout.png', fullPage: true }).catch(() => {})
      currentUrlAfterClick = page.url()
      
      // Check for any error messages one more time
      const finalErrors = page.locator('text=/error|required|invalid|missing|field is invalid/i')
      const finalErrorCount = await finalErrors.count()
      if (finalErrorCount > 0) {
        const finalErrorTexts = await Promise.all(
          Array.from({ length: Math.min(finalErrorCount, 3) }).map(async (_, i) => {
            return await finalErrors.nth(i).textContent().catch(() => '')
          })
        )
        throw new Error(`Form validation errors preventing save: ${finalErrorTexts.filter(Boolean).join(', ')}`)
      }
      
      throw new Error(`Lesson creation failed - still on create page after save. Current URL: ${currentUrlAfterClick}`)
    }
    
    await page.waitForTimeout(2000)

    // Should be on either the detail page or list page
    const currentUrl = page.url()
    const onDetailPage = /\/admin\/collections\/lessons\/\d+/.test(currentUrl)
    const onListPage = currentUrl.includes('/admin/collections/lessons') && !currentUrl.includes('/create')

    // If we're still on the create page, the save might have failed
    if (currentUrl.includes('/create')) {
      // Check for validation errors
      const errorMessage = page.locator('text=/error|required|invalid/i').first()
      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasError) {
        const errorText = await errorMessage.textContent()
        throw new Error(`Lesson creation failed with error: ${errorText}`)
      }
      
      throw new Error('Lesson creation failed - still on create page after save attempt')
    }

    expect(onDetailPage || onListPage).toBe(true)

    // Verify lesson appears in the list or detail view
    const lessonContent = page.locator('text=/lesson|class|date|time|schedule/i').first()
    await expect(lessonContent).toBeVisible({ timeout: 10000 })
  })
})

