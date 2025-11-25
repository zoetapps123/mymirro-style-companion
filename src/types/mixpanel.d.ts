interface Window {
  mixpanel?: {
    track: (event: string, props?: Record<string, any>) => void;
    identify: (id: string) => void;
    people: {
      set: (props: Record<string, any>) => void;
    };
  };
  __mixpanel_initialized__?: boolean;
}
