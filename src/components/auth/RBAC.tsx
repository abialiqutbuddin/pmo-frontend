
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';

interface CanProps {
    I: string; // action e.g. "create"
    a: string; // module e.g. "tasks"
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Conditionally renders children if user has permission.
 * Usage: <Can I="create" a="tasks"><Button /></Can>
 */
export const Can: React.FC<CanProps> = ({ I, a, children, fallback = null }) => {
    const hasAuthPermission = useAuthStore((state) => state.hasPermission);
    const hasEventPermission = useContextStore((state) => state.hasEventPermission);

    if (hasAuthPermission(a, I) || hasEventPermission(a, I)) {
        return <>{children}</>;
    }
    return <>{fallback}</>;
};

/**
 * HOC to protect a component.
 */
export function withPermission<P extends object>(
    Component: React.ComponentType<P>,
    module: string,
    action: string,
    fallback: React.ReactNode = null
) {
    return (props: P) => {
        const hasAuthPermission = useAuthStore((state) => state.hasPermission);
        const hasEventPermission = useContextStore((state) => state.hasEventPermission);

        if (!hasAuthPermission(module, action) && !hasEventPermission(module, action)) {
            return <>{fallback}</>;
        }
        return <Component {...props} />;
    };
}
