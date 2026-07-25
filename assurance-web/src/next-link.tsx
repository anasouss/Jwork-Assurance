import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import type { LinkProps } from "react-router-dom";

type NextLinkProps = Omit<LinkProps, "to"> & {
  href: LinkProps["to"];
  prefetch: boolean;
};

const Link = React.forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ href, ...rest }, ref) => {
    return <RouterLink ref={ref} to={href} {...rest} />;
  }
);

Link.displayName = "NextLink";

export default Link;
