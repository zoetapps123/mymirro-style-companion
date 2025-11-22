import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";

export interface TrackedButtonProps extends ButtonProps {
  analyticsId: string;
  eventType?: string;
  eventData?: Record<string, any>;
  eventCategory?: string;
  trackOnClick?: boolean;
}

/**
 * TrackedButton - A button component that automatically tracks user interactions
 * 
 * Usage:
 * <TrackedButton 
 *   analyticsId="wardrobe-add-item"
 *   eventType="button_click"
 *   eventData={{ section: 'wardrobe', action: 'add' }}
 * >
 *   Add Item
 * </TrackedButton>
 */
const TrackedButton = React.forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ 
    analyticsId, 
    eventType = ANALYTICS_EVENTS.BUTTON_CLICK,
    eventData = {},
    eventCategory = 'interaction',
    trackOnClick = true,
    onClick,
    children,
    ...props 
  }, ref) => {
    const { trackClick, trackCustom } = useAnalytics();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Track the click
      if (trackOnClick) {
        const target = e.currentTarget;
        const elementText = typeof children === 'string' ? children : target.textContent || '';
        
        trackCustom(
          eventType,
          {
            element_id: analyticsId,
            element_text: elementText,
            ...eventData
          },
          `${eventCategory}:${analyticsId}`
        );
      }
      
      // Call original onClick handler
      if (onClick) {
        onClick(e);
      }
    };
    
    return (
      <Button 
        ref={ref} 
        onClick={handleClick}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TrackedButton.displayName = "TrackedButton";

export { TrackedButton };
