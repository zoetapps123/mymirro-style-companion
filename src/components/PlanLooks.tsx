import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PlanLooksProps {
  onBack: () => void;
}

const occasions = [
  "Casual Day Out",
  "Office",
  "Dinner Date",
  "Party",
  "Wedding",
  "Travel",
  "Interview"
];

const PlanLooks = ({ onBack }: PlanLooksProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<any[]>([]);
  const [eventForm, setEventForm] = useState({
    title: "",
    occasion: occasions[0],
    place: "",
    outfitId: ""
  });

  useEffect(() => {
    fetchEvents();
    fetchSavedOutfits();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select(`
        *,
        event_outfits (
          outfit_id,
          event_date,
          outfits (
            id,
            name,
            preview_image_url
          )
        )
      `)
      .order('start_date', { ascending: true });

    setEvents(data || []);
  };

  const fetchSavedOutfits = async () => {
    const { data } = await supabase
      .from('outfits')
      .select('*')
      .order('created_at', { ascending: false });

    setSavedOutfits(data || []);
  };

  const createEvent = async () => {
    if (!eventForm.title.trim() || !date) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: eventForm.title,
          occasion: eventForm.occasion,
          place: eventForm.place,
          start_date: format(date, 'yyyy-MM-dd'),
          end_date: format(date, 'yyyy-MM-dd')
        })
        .select()
        .single();

      if (eventError) throw eventError;

      if (eventForm.outfitId) {
        const { error: outfitError } = await supabase
          .from('event_outfits')
          .insert({
            event_id: event.id,
            outfit_id: eventForm.outfitId,
            event_date: format(date, 'yyyy-MM-dd')
          });

        if (outfitError) throw outfitError;
      }

      toast({
        title: "Event scheduled!",
        description: "Your calendar just got stylish.",
      });

      setShowEventDialog(false);
      setEventForm({ title: "", occasion: occasions[0], place: "", outfitId: "" });
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create event.",
        variant: "destructive",
      });
    }
  };

  const eventsForSelectedDate = events.filter(event => {
    if (!date) return false;
    const eventDate = new Date(event.start_date);
    return eventDate.toDateString() === date.toDateString();
  });

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Plan Your Looks</h2>
        <p className="text-sm text-muted-foreground">
          Schedule outfits on your calendar
        </p>
      </div>

      {/* Calendar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md"
          />
        </CardContent>
      </Card>

      {/* Events for selected date */}
      <div className="flex-1 overflow-auto space-y-3">
        {date && (
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {format(date, 'MMMM d, yyyy')}
            </h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowEventDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        )}

        {eventsForSelectedDate.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-6 text-center">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No events scheduled for this day
              </p>
            </CardContent>
          </Card>
        ) : (
          eventsForSelectedDate.map(event => (
            <Card key={event.id} className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">{event.title}</CardTitle>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Badge variant="outline">{event.occasion}</Badge>
                  {event.place && (
                    <Badge variant="secondary">{event.place}</Badge>
                  )}
                </div>
              </CardHeader>
              {event.event_outfits?.[0]?.outfits && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Outfit: {event.event_outfits[0].outfits.name}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Plan your outfit for {date && format(date, 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Event name"
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Occasion</label>
              <div className="flex flex-wrap gap-2">
                {occasions.map(occasion => (
                  <Badge
                    key={occasion}
                    variant={eventForm.occasion === occasion ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setEventForm({ ...eventForm, occasion })}
                  >
                    {occasion}
                  </Badge>
                ))}
              </div>
            </div>

            <Input
              placeholder="Place (optional)"
              value={eventForm.place}
              onChange={(e) => setEventForm({ ...eventForm, place: e.target.value })}
            />

            {savedOutfits.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Outfit (optional)</label>
                <select
                  className="w-full p-2 rounded-md border border-border bg-background"
                  value={eventForm.outfitId}
                  onChange={(e) => setEventForm({ ...eventForm, outfitId: e.target.value })}
                >
                  <option value="">Generate fresh outfit</option>
                  {savedOutfits.map(outfit => (
                    <option key={outfit.id} value={outfit.id}>
                      {outfit.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button onClick={createEvent} className="w-full" disabled={!eventForm.title.trim()}>
              Create Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanLooks;
