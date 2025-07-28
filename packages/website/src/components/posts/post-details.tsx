import Image from "next/image";
import Link from "next/link";

import { Post } from "@repo/shared-types";
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card";

export const PostDetail = ({ post }: { post: Post }) => {
  return (
    <Link key={post.id} href={`/blog/${post.slug}`} className="group">
      <Card className="overflow-hidden h-full transition-all duration-200 hover:shadow-md">
        {post.heroImage && (
          <div className="aspect-video relative overflow-hidden">
            <Image
              src={post.heroImage?.url || "/placeholder.svg"}
              alt={post.heroImage?.alt || ""}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-muted-foreground line-clamp-3">{post.excerpt}</p>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <span className="group-hover:text-primary transition-colors">
            Read more →
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
};
