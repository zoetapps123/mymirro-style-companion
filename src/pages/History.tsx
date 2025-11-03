import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Camera, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const History = () => {
  const navigate = useNavigate();
  const [styleChecks, setStyleChecks] = useState<any[]>([]);
  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<any>(null);
  const [selectedBattle, setSelectedBattle] = useState<any>(null);

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
                    onClick={() => setSelectedCheck(check)}
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
                  const winner = results?.participants?.[0] || results?.[0];
                  
                  return (
                    <motion.div
                      key={battle.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedBattle(battle)}
                      className="cursor-pointer"
                    >
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{participants.length}-Way Battle</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Winner: {winner?.name || winner?.persona_name} 👑
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(battle.created_at)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {participants.slice(0, 4).map((p: any, i: number) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Camera className="w-8 h-8 text-muted-foreground" />
                                </div>
                              )}
                              {results?.[i]?.rank === 1 && (
                                <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                  👑 Winner
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                <p className="text-white text-xs font-medium truncate">{p.name}</p>
                                {p.occasion && <p className="text-white/80 text-[10px]">{p.occasion}</p>}
                              </div>
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

      {/* Style Check Detail Dialog */}
      <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCheck?.outfit_name}</DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            <div className="space-y-4">
              <img 
                src={selectedCheck.image_url} 
                alt={selectedCheck.outfit_name}
                className="w-full rounded-xl object-cover"
              />
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-lg">
                  {selectedCheck.overall_score.toFixed(1)} / 5.0
                </Badge>
                <p className="text-sm text-muted-foreground">{selectedCheck.occasion}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-sm">What Works ✨</h4>
                <p className="text-sm text-muted-foreground">{selectedCheck.verdict_positive}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-sm">What Could Improve</h4>
                <p className="text-sm text-muted-foreground">{selectedCheck.verdict_improvements}</p>
              </div>
              {selectedCheck.quick_fix && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Quick Fixes 🔧</h4>
                  <ul className="space-y-1">
                    {selectedCheck.quick_fix.split(' | ').map((fix: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">• {fix}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Color</p>
                  <p className="font-semibold">{selectedCheck.color_score.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fit</p>
                  <p className="font-semibold">{selectedCheck.fit_score.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Texture</p>
                  <p className="font-semibold">{selectedCheck.texture_score.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Occasion</p>
                  <p className="font-semibold">{selectedCheck.occasion_score.toFixed(1)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Battle Detail Dialog */}
      <Dialog open={!!selectedBattle} onOpenChange={() => setSelectedBattle(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Battle Results</DialogTitle>
          </DialogHeader>
          {selectedBattle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(selectedBattle.participants as any[]).map((p: any, i: number) => (
                  <div key={i} className="relative">
                    {p.image_url ? (
                      <img 
                        src={p.image_url}
                        alt={p.name}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center rounded-lg">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {selectedBattle.results?.[i]?.rank === 1 && (
                      <div className="absolute -top-2 -right-2">
                        <Crown className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {(selectedBattle.results as any[])?.map((r: any, i: number) => (
                  <div key={i} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-semibold">{r.rank}. {r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.persona_name}</p>
                      </div>
                      <Badge variant={r.rank === 1 ? "default" : "secondary"}>
                        {r.score.toFixed(1)} / 5.0
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground italic">{r.roast}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;
