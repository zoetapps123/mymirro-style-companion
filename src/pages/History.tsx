import { useState, useEffect } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const History = () => {
  const navigate = useNavigate();
  const [styleChecks, setStyleChecks] = useState<any[]>([]);
  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch style checks
      const { data: checks } = await supabase
        .from('style_checks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch battles
      const { data: battlesData } = await supabase
        .from('battles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setStyleChecks(checks || []);
      setBattles(battlesData || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="w-8 h-8" />
          History
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="style-check" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="style-check">Style Check</TabsTrigger>
              <TabsTrigger value="battle">Outfit Battle</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="style-check" className="flex-1 overflow-y-auto px-4 pb-4 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : styleChecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-lg">No style checks yet</p>
                <p className="text-sm">Your scored outfits will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {styleChecks.map((check, idx) => (
                  <motion.div
                    key={check.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                      <div className="aspect-square relative">
                        <img
                          src={check.image_url}
                          alt={check.outfit_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-bold">
                          {check.overall_score.toFixed(1)}/5.0
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm truncate">{check.outfit_name}</h3>
                        <p className="text-xs text-muted-foreground">{formatDate(check.created_at)}</p>
                        {check.occasion && (
                          <p className="text-xs text-muted-foreground mt-1">For: {check.occasion}</p>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="battle" className="flex-1 overflow-y-auto px-4 pb-4 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : battles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-lg">No outfit battles yet</p>
                <p className="text-sm">Your epic battles will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {battles.map((battle, idx) => {
                  const participants = battle.participants as any[];
                  const results = battle.results as any;
                  
                  return (
                    <motion.div
                      key={battle.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">{participants.length}-Way Battle</h3>
                          <p className="text-xs text-muted-foreground">{formatDate(battle.created_at)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {participants.map((p: any, i: number) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                              <img
                                src={p.image_url}
                                alt={`Participant ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {results?.participants?.[i]?.rank === 1 && (
                                <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                  👑 Winner
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default History;
