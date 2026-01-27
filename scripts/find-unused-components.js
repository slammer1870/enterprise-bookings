#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all component files (.tsx and index.ts files that export components)
function findComponentFiles(rootDir) {
  const files = [];
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .git, dist, build, etc.
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build' ||
          entry.name === '.next') {
        continue;
      }
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        // Include .tsx files and index.ts files in src directories (which often export components)
        if (entry.name.endsWith('.tsx') || 
            (entry.name === 'index.ts' && fullPath.includes('/src/'))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walkDir(rootDir);
  return files;
}

// Extract component names from a file
function extractComponentNames(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const components = [];
    
    // Match export default function/const/class
    const defaultExportMatch = content.match(/export\s+default\s+(?:function|const|class)\s+(\w+)/);
    if (defaultExportMatch) {
      components.push({ name: defaultExportMatch[1], isDefault: true });
    }
    
    // Match export const/function ComponentName
    const namedExports = content.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g);
    for (const match of namedExports) {
      // Skip if it's a type or interface
      if (!content.includes(`export type ${match[1]}`) && 
          !content.includes(`export interface ${match[1]}`)) {
        components.push({ name: match[1], isDefault: false });
      }
    }
    
    // Also check for export { ComponentName } or export { default as ComponentName }
    const reExports = content.matchAll(/export\s*{\s*([^}]+)\s*}/g);
    for (const match of reExports) {
      const exports = match[1].split(',').map(e => e.trim());
      for (const exp of exports) {
        // Handle "default as ComponentName" pattern
        let componentName = exp;
        if (exp.includes(' as ')) {
          componentName = exp.split(' as ')[1].trim();
        } else {
          componentName = exp.trim();
        }
        
        // Skip types, interfaces, and non-component exports
        if (componentName && 
            !componentName.startsWith('type ') && 
            !componentName.startsWith('interface ') &&
            !componentName.startsWith('//')) {
          // Check if it looks like a component (PascalCase) or is a known export pattern
          if (componentName[0] === componentName[0].toUpperCase() || 
              exp.includes('default as')) {
            components.push({ 
              name: componentName, 
              isDefault: exp.includes('default as'),
            });
          }
        }
      }
    }
    
    return components;
  } catch (error) {
    return [];
  }
}

// Get the base name for searching (file name without extension)
function getSearchName(filePath, componentName) {
  const relativePath = path.relative(process.cwd(), filePath);
  const dir = path.dirname(relativePath);
  const baseName = path.basename(relativePath, '.tsx');
  
  // Try different import patterns
  return [
    componentName,
    baseName,
    path.basename(dir),
    relativePath.replace(/\.tsx$/, ''),
    relativePath.replace(/^\.\//, '').replace(/\.tsx$/, ''),
  ];
}

// Build component-to-file mapping (which file exports which components)
function buildComponentMap(rootDir, componentFiles) {
  const componentMap = new Map(); // component name -> { file, isDefault, exports }
  const fileExports = new Map(); // file -> Set of exported component names
  
  for (const file of componentFiles) {
    const components = extractComponentNames(file);
    const relativePath = path.relative(rootDir, file);
    const exportedNames = new Set();
    
    for (const component of components) {
      exportedNames.add(component.name);
      if (!componentMap.has(component.name)) {
        componentMap.set(component.name, []);
      }
      componentMap.get(component.name).push({
        file: relativePath,
        isDefault: component.isDefault,
      });
    }
    
    fileExports.set(relativePath, exportedNames);
  }
  
  return { componentMap, fileExports };
}

// Build re-export chain (track components exported from index files)
function buildReExportChain(rootDir, sourceFiles) {
  const reExports = new Map(); // file -> Set of files it re-exports from
  
  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(rootDir, file);
      const fileDir = path.dirname(file);
      
      // Check for re-exports: export * from or export { ... } from
      const exportFromMatches = content.matchAll(/export\s+(?:\*\s+from|(?:\{[^}]*\}\s+from))\s+['"]([^'"]+)['"]/g);
      for (const match of exportFromMatches) {
        const importPath = match[1];
        let resolvedPath = importPath;
        
        if (importPath.startsWith('.')) {
          resolvedPath = path.resolve(fileDir, importPath);
          if (!resolvedPath.endsWith('.tsx') && !resolvedPath.endsWith('.ts')) {
            for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
              const testPath = resolvedPath + ext;
              if (fs.existsSync(testPath)) {
                resolvedPath = testPath;
                break;
              }
            }
          }
          resolvedPath = path.relative(rootDir, resolvedPath);
          
          if (!reExports.has(relativePath)) {
            reExports.set(relativePath, new Set());
          }
          reExports.get(relativePath).add(resolvedPath);
        }
      }
    } catch (e) {
      // Skip
    }
  }
  
  return reExports;
}

// Build usage index - scan all files once
function buildUsageIndex(rootDir, componentMap) {
  console.log('Building usage index...');
  const usageIndex = new Map(); // component name -> Set of files that use it
  const stringReferences = new Map(); // file path -> Set of files that reference it as string
  const dynamicImports = new Set(); // component names used in dynamic imports
  
  // Find all source files
  const sourceFiles = [];
  function findSourceFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build' ||
          entry.name === '.next') {
        continue;
      }
      if (entry.isDirectory()) {
        findSourceFiles(fullPath);
      } else if (entry.isFile() && 
                 (entry.name.endsWith('.ts') || 
                  entry.name.endsWith('.tsx') || 
                  entry.name.endsWith('.js') || 
                  entry.name.endsWith('.jsx') ||
                  entry.name.endsWith('.mjs') ||
                  entry.name.endsWith('.cjs'))) {
        sourceFiles.push(fullPath);
      }
    }
  }
  findSourceFiles(rootDir);
  
  console.log(`Scanning ${sourceFiles.length} source files for component usage...`);
  
  // Scan all files once
  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(rootDir, file);
      
      // 1. Extract all component names used in JSX
      const jsxMatches = content.matchAll(/<(\w+)[\s>]|\{(\w+)\}/g);
      for (const match of jsxMatches) {
        const componentName = match[1] || match[2];
        if (componentName && componentName[0] === componentName[0].toUpperCase()) {
          if (!usageIndex.has(componentName)) {
            usageIndex.set(componentName, new Set());
          }
          usageIndex.get(componentName).add(relativePath);
        }
      }
      
      // 2. Extract imports to map component names to their source files
      const importMatches = content.matchAll(/import\s+(?:(?:\*\s+as\s+(\w+))|(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[4];
        const defaultImport = match[3];
        const namedImports = match[2];
        
        // Resolve import path to actual file
        let resolvedPath = importPath;
        if (importPath.startsWith('.')) {
          const fileDir = path.dirname(file);
          resolvedPath = path.resolve(fileDir, importPath);
          if (!resolvedPath.endsWith('.tsx') && !resolvedPath.endsWith('.ts')) {
            for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
              const testPath = resolvedPath + ext;
              if (fs.existsSync(testPath)) {
                resolvedPath = testPath;
                break;
              }
            }
          }
          resolvedPath = path.relative(rootDir, resolvedPath);
        }
        
        // Track default imports
        if (defaultImport) {
          if (!usageIndex.has(defaultImport)) {
            usageIndex.set(defaultImport, new Set());
          }
          usageIndex.get(defaultImport).add(relativePath);
        }
        
        // Track named imports
        if (namedImports) {
          const imports = namedImports.split(',').map(i => i.trim().split(' as ')[0].trim());
          for (const imp of imports) {
            if (!usageIndex.has(imp)) {
              usageIndex.set(imp, new Set());
            }
            usageIndex.get(imp).add(relativePath);
          }
        }
      }
      
      // 3. Check for dynamic imports: import(), require(), lazy()
      const dynamicImportPatterns = [
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ];
      
      for (const pattern of dynamicImportPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const importPath = match[1];
          let resolvedPath = importPath;
          if (importPath.startsWith('.')) {
            const fileDir = path.dirname(file);
            resolvedPath = path.resolve(fileDir, importPath);
            if (!resolvedPath.endsWith('.tsx') && !resolvedPath.endsWith('.ts')) {
              for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
                const testPath = resolvedPath + ext;
                if (fs.existsSync(testPath)) {
                  resolvedPath = testPath;
                  break;
                }
              }
            }
            resolvedPath = path.relative(rootDir, resolvedPath);
            dynamicImports.add(resolvedPath);
          }
        }
      }
      
      // 4. Check for string-based file path references (Payload CMS configs, etc.)
      // Look for patterns like: '/components/Component', '@/components/Component', './components/Component'
      const stringPathPatterns = [
        /['"](?:\/|@\/|\.\/)[^'"]*\/[^'"]*['"]/g,
        /path:\s*['"]([^'"]+)['"]/g,
        /Component:\s*['"]([^'"]+)['"]/g,
      ];
      
      for (const pattern of stringPathPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const filePath = match[1] || match[0].replace(/['"]/g, '');
          // Try to resolve the path
          let resolvedPath = filePath;
          if (filePath.startsWith('.') || filePath.startsWith('/') || filePath.startsWith('@/')) {
            const fileDir = path.dirname(file);
            if (filePath.startsWith('@/')) {
              // Try to resolve @ alias (common in Next.js)
              resolvedPath = path.resolve(fileDir, filePath.replace('@/', ''));
            } else if (filePath.startsWith('/')) {
              // Absolute path from project root
              resolvedPath = path.resolve(rootDir, filePath);
            } else {
              // Relative path
              resolvedPath = path.resolve(fileDir, filePath);
            }
            
            // Try common extensions
            if (!fs.existsSync(resolvedPath)) {
              for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
                const testPath = resolvedPath + ext;
                if (fs.existsSync(testPath)) {
                  resolvedPath = testPath;
                  break;
                }
              }
            }
            
            if (fs.existsSync(resolvedPath)) {
              resolvedPath = path.relative(rootDir, resolvedPath);
              if (!stringReferences.has(resolvedPath)) {
                stringReferences.set(resolvedPath, new Set());
              }
              stringReferences.get(resolvedPath).add(relativePath);
            }
          }
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  console.log(`Index built with ${usageIndex.size} component references`);
  console.log(`Found ${stringReferences.size} files referenced as strings`);
  console.log(`Found ${dynamicImports.size} files in dynamic imports\n`);
  
  return { usageIndex, stringReferences, dynamicImports };
}

// Check if component is a Next.js special export (used by framework, not imported)
function isNextJsSpecialExport(componentName, filePath) {
  const nextJsExports = [
    'metadata',
    'generateMetadata',
    'dynamic',
    'revalidate',
    'dynamicParams',
    'generateStaticParams',
    'viewport',
    'generateViewport',
  ];
  
  if (nextJsExports.includes(componentName)) {
    return true;
  }
  
  // Check if it's a page component (default export in app directory)
  const relativePath = path.relative(process.cwd(), filePath);
  if (relativePath.includes('/app/') && 
      (relativePath.includes('/page.tsx') || 
       relativePath.includes('/layout.tsx') ||
       relativePath.includes('/loading.tsx') ||
       relativePath.includes('/not-found.tsx'))) {
    // Default exports in Next.js app directory are used by file-based routing
    return true;
  }
  
  return false;
}

// Check if component is used via re-exports
function isReExported(componentName, filePath, componentMap, reExports, rootDir) {
  const relativePath = path.relative(rootDir, filePath);
  
  // Check if this component is exported from index files that are re-exported
  const componentDefs = componentMap.get(componentName) || [];
  for (const def of componentDefs) {
    if (def.file === relativePath) {
      // Check if the file is re-exported from an index file
      for (const [indexFile, exportedFiles] of reExports.entries()) {
        if (exportedFiles.has(relativePath)) {
          // This file is re-exported from an index file
          // Check if the index file itself is used
          return { used: true, usedIn: indexFile, reason: 're-exported' };
        }
      }
    }
  }
  
  return { used: false };
}

// Check if component is used (now with multiple detection methods)
function isComponentUsed(componentName, filePath, usageIndex, stringReferences, dynamicImports, componentMap, reExports, rootDir) {
  // Skip Next.js special exports
  if (isNextJsSpecialExport(componentName, filePath)) {
    return { used: true, usedIn: 'Next.js framework', reason: 'Next.js export' };
  }
  
  const relativePath = path.relative(rootDir, filePath);
  
  // 1. Check direct usage (JSX/imports)
  if (usageIndex.has(componentName)) {
    const usingFiles = usageIndex.get(componentName);
    const externalUsage = Array.from(usingFiles).filter(f => f !== relativePath);
    if (externalUsage.length > 0) {
      return { used: true, usedIn: externalUsage[0], reason: 'direct usage' };
    }
  }
  
  // 2. Check if file is referenced as a string (Payload CMS configs, etc.)
  if (stringReferences.has(relativePath)) {
    const referencingFiles = Array.from(stringReferences.get(relativePath));
    return { used: true, usedIn: referencingFiles[0], reason: 'string reference' };
  }
  
  // 3. Check if file is dynamically imported
  if (dynamicImports.has(relativePath)) {
    return { used: true, usedIn: 'dynamic import', reason: 'dynamic import' };
  }
  
  // 4. Check if component is re-exported from an index file
  const reExportCheck = isReExported(componentName, filePath, componentMap, reExports, rootDir);
  if (reExportCheck.used) {
    return reExportCheck;
  }
  
  // 5. Check if file name matches component name (common pattern)
  const fileName = path.basename(filePath, '.tsx');
  if (fileName === componentName || fileName.toLowerCase() === componentName.toLowerCase()) {
    // Check if the file path itself is referenced
    const fileDir = path.dirname(relativePath);
    const possiblePaths = [
      relativePath,
      relativePath.replace(/\.tsx$/, ''),
      `/${relativePath}`,
      `@/${relativePath}`,
    ];
    
    for (const possiblePath of possiblePaths) {
      for (const [referencedFile, referencingFiles] of stringReferences.entries()) {
        if (referencedFile.includes(possiblePath) || possiblePath.includes(referencedFile)) {
          return { used: true, usedIn: Array.from(referencingFiles)[0], reason: 'file path reference' };
        }
      }
    }
  }
  
  return { used: false };
}

// Main analysis
function analyzeComponents() {
  const rootDir = process.cwd();
  console.log('Finding all component files...');
  const componentFiles = findComponentFiles(rootDir);
  console.log(`Found ${componentFiles.length} component files\n`);
  
  // Build component map and re-export chain
  console.log('Building component map...');
  const { componentMap, fileExports } = buildComponentMap(rootDir, componentFiles);
  
  // Find all source files for re-export analysis
  const allSourceFiles = [];
  function findAllSourceFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build' ||
          entry.name === '.next') {
        continue;
      }
      if (entry.isDirectory()) {
        findAllSourceFiles(fullPath);
      } else if (entry.isFile() && 
                 (entry.name.endsWith('.ts') || 
                  entry.name.endsWith('.tsx') || 
                  entry.name.endsWith('.js') || 
                  entry.name.endsWith('.jsx'))) {
        allSourceFiles.push(fullPath);
      }
    }
  }
  findAllSourceFiles(rootDir);
  
  console.log('Building re-export chain...');
  const reExports = buildReExportChain(rootDir, allSourceFiles);
  
  // Build usage index once (single pass)
  const { usageIndex, stringReferences, dynamicImports } = buildUsageIndex(rootDir, componentMap);
  
  const unusedComponents = [];
  const usedComponents = [];
  const potentiallyUsed = []; // Components that might be used via indirect means
  
  for (const file of componentFiles) {
    const components = extractComponentNames(file);
    
    if (components.length === 0) {
      continue;
    }
    
    for (const component of components) {
      const usage = isComponentUsed(
        component.name, 
        file, 
        usageIndex, 
        stringReferences, 
        dynamicImports,
        componentMap,
        reExports,
        rootDir
      );
      
      if (!usage.used) {
        // Check if it's exported from an index file (might be used via package exports)
        const relativePath = path.relative(rootDir, file);
        const isIndexFile = path.basename(file) === 'index.tsx' || path.basename(file) === 'index.ts';
        
        if (isIndexFile) {
          potentiallyUsed.push({
            file,
            component: component.name,
            isDefault: component.isDefault,
            reason: 'exported from index file (may be used via package)',
          });
        } else {
          unusedComponents.push({
            file,
            component: component.name,
            isDefault: component.isDefault,
          });
        }
      } else {
        usedComponents.push({
          file,
          component: component.name,
          usedIn: usage.usedIn,
          reason: usage.reason || 'unknown',
        });
      }
    }
  }
  
  // Print results
  console.log('='.repeat(80));
  console.log('UNUSED COMPONENTS (confirmed):');
  console.log('='.repeat(80));
  
  if (unusedComponents.length === 0) {
    console.log('No unused components found!');
  } else {
    unusedComponents.forEach(({ file, component, isDefault }) => {
      const relativePath = path.relative(rootDir, file);
      console.log(`\n${relativePath}`);
      console.log(`  Component: ${component}${isDefault ? ' (default export)' : ''}`);
    });
  }
  
  if (potentiallyUsed.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('POTENTIALLY USED COMPONENTS (exported from index files):');
    console.log('='.repeat(80));
    potentiallyUsed.forEach(({ file, component, isDefault, reason }) => {
      const relativePath = path.relative(rootDir, file);
      console.log(`\n${relativePath}`);
      console.log(`  Component: ${component}${isDefault ? ' (default export)' : ''}`);
      console.log(`  Reason: ${reason}`);
    });
  }
  
  console.log(`\n\nTotal unused components: ${unusedComponents.length}`);
  console.log(`Total potentially used (index exports): ${potentiallyUsed.length}`);
  console.log(`Total used components: ${usedComponents.length}`);
}

analyzeComponents();
