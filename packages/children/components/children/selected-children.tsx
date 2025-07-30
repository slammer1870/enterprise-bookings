import { User } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { X } from 'lucide-react'

type SelectedChildrenProps = {
  selectedChildren: User[]
  handleRemoveChild: (child: User) => void
}

export const SelectedChildren = ({
  selectedChildren,
  handleRemoveChild,
}: SelectedChildrenProps) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {selectedChildren && selectedChildren.length > 0 && (
        <div className="flex flex-col gap-2 w-full">
          {selectedChildren.map((child) => (
            <div key={child.id} className="flex items-center gap-2 justify-between">
              <p>
                {child.name} - {child.email}
              </p>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRemoveChild(child)}
                className="p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
