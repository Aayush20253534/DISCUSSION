import { useEffect } from 'react'

function meta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
    document.head.appendChild(element)
  }
  return element
}

function link(rel) {
  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.appendChild(element)
  }
  return element
}

export function applyPageMeta({
  title,
  description,
  path = window.location.pathname,
  image = '/social-card.png',
  noindex = false,
}) {
  const origin = window.location.origin
  const canonical = new URL(path, origin).href
  const imageUrl = new URL(image, origin).href
  document.title = title
  meta('meta[name="description"]', { name: 'description' }).content = description
  meta('meta[name="robots"]', { name: 'robots' }).content = noindex
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large'
  meta('meta[property="og:title"]', { property: 'og:title' }).content = title
  meta('meta[property="og:description"]', { property: 'og:description' }).content = description
  meta('meta[property="og:type"]', { property: 'og:type' }).content = 'website'
  meta('meta[property="og:url"]', { property: 'og:url' }).content = canonical
  meta('meta[property="og:image"]', { property: 'og:image' }).content = imageUrl
  meta('meta[name="twitter:card"]', { name: 'twitter:card' }).content = 'summary_large_image'
  meta('meta[name="twitter:title"]', { name: 'twitter:title' }).content = title
  meta('meta[name="twitter:description"]', { name: 'twitter:description' }).content = description
  meta('meta[name="twitter:image"]', { name: 'twitter:image' }).content = imageUrl
  link('canonical').href = canonical
}

export function usePageMeta(options) {
  const { title, description, path, image, noindex = false } = options
  useEffect(() => {
    applyPageMeta({ title, description, path, image, noindex })
  }, [title, description, path, image, noindex])
}
