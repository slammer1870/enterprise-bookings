import Image from 'next/image'
import Link from 'next/link'
import { FC } from 'react'

const Footer: FC = () => {
  return (
    <footer className="body-font text-gray-600">
      <div className="container mx-auto flex flex-col items-center justify-between px-5 py-8 sm:flex-row">
        <a className="title-font flex items-center justify-center font-medium text-gray-900 md:justify-start">
          <Image src="/logo.svg" alt="logo" width={48} height={48} className="h-12" />
        </a>
        <p className="mt-4 text-sm text-gray-500 sm:ml-4 sm:mt-0 sm:border-l-2 sm:border-gray-200 sm:py-2 sm:pl-4">
          © {new Date().getFullYear()} Dark Horse Strength and Performance
        </p>
        <Link href="/blog" className="mx-auto">
          <span className="item-center mt-4 inline-flex justify-center text-gray-500 sm:mt-0">
            <svg
              fill="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1"
              className="h-4 w-4"
              viewBox="0 0 16 16"
            >
              <path
                id="external-link-alt-solid"
                d="M13.8,10.22H12.774a.511.511,0,0,0-.511.511v3.577H2.044V4.088h4.6a.511.511,0,0,0,.511-.511V2.555a.511.511,0,0,0-.511-.511H1.533A1.533,1.533,0,0,0,0,3.577V14.818a1.533,1.533,0,0,0,1.533,1.533H12.774a1.533,1.533,0,0,0,1.533-1.533V10.731A.511.511,0,0,0,13.8,10.22ZM15.585,0H11.5a.768.768,0,0,0-.543,1.309L12.1,2.45,4.311,10.231a.766.766,0,0,0,0,1.086l.724.723a.766.766,0,0,0,1.086,0L13.9,4.258,15.042,5.4a.768.768,0,0,0,1.309-.543V.766A.766.766,0,0,0,15.585,0Z"
              />
            </svg>
            <p className="ml-3 text-sm font-light uppercase">Check out our blog</p>
          </span>
        </Link>
        <span className="mt-4 inline-flex justify-center sm:ml-auto sm:mt-0 sm:justify-start">
          <a
            className="text-gray-500"
            href="https://www.youtube.com/channel/UCSWgpR7d3FvxS6axlfLExCQ"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 17.406 12.239"
              fill="currentColor"
              className="h-5 w-6"
            >
              <path
                id="youtube-brands"
                d="M31.975,65.915a2.187,2.187,0,0,0-1.539-1.549,51.686,51.686,0,0,0-6.8-.366,51.686,51.686,0,0,0-6.8.366A2.187,2.187,0,0,0,15.3,65.915a24.625,24.625,0,0,0,0,8.433,2.154,2.154,0,0,0,1.539,1.524,51.685,51.685,0,0,0,6.8.366,51.685,51.685,0,0,0,6.8-.366,2.154,2.154,0,0,0,1.539-1.524,24.625,24.625,0,0,0,0-8.433Zm-10.119,6.8V67.544l4.549,2.588Z"
                transform="translate(-14.933 -64)"
              />
            </svg>
          </a>
          <a
            className="ml-3 text-gray-500"
            href="https://www.facebook.com/darkhorsegymbray"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              fill="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-5 w-5"
              viewBox="0 0 24 24"
            >
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path>
            </svg>
          </a>
          <a
            className="ml-3 text-gray-500"
            href="https://www.instagram.com/darkhorsegymbray"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-5 w-5"
              viewBox="0 0 24 24"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01"></path>
            </svg>
          </a>
        </span>
      </div>
    </footer>
  )
}

export default Footer
