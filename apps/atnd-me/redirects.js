const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // Standalone bru-grappling served the blog at /blog. ATND-me tenants use /posts.
  // Permanent redirects keep indexed article URLs and inbound links working.
  const blogArchiveRedirect = {
    source: '/blog',
    destination: '/posts',
    permanent: true,
  }
  const blogPostRedirect = {
    source: '/blog/:path*',
    destination: '/posts/:path*',
    permanent: true,
  }

  const redirects = [internetExplorerRedirect, blogArchiveRedirect, blogPostRedirect]

  return redirects
}

export default redirects
