import React from 'react'

type TeamMember = {
  name: string
  role: string
  bio: string
}

type CoachingTeamProps = {
  heading: string
  teamMembers: TeamMember[]
}

export const CoachingTeamBlock: React.FC<CoachingTeamProps> = ({
  heading,
  teamMembers,
}) => {
  return (
    <section className="text-gray-900">
      <div className="py-20 lg:mx-52">
        <div className="flex flex-col text-left lg:text-center w-full px-4">
          <h1 className="text-3xl font-medium mb-4 text-gray-900">{heading}</h1>
        </div>
        <div className="flex flex-wrap mx-auto">
          {teamMembers?.map((member, index) => (
            <div key={index} className="p-4 lg:w-1/2">
              <div className="h-full flex sm:flex-row flex-col items-start justify-start text-left">
                <div className="flex-grow sm:pl-8">
                  <h2 className="title-font font-medium text-lg text-gray-900">
                    {member.name}
                  </h2>
                  <h3 className="text-gray-500 mb-3">{member.role}</h3>
                  <p className="mb-4">{member.bio}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 