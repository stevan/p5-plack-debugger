package Plack::Debugger;

use strict;
use warnings;

use Plack::App::Debugger;

use Plack::Middleware::Debugger::Collector;
use Plack::Middleware::Debugger::Injector;

use Plack::Debugger::Panel;

use Plack::Util::Accessor (
    'data_dir',   # directory where collected debugging data is stored
    'panels',     # array ref of Plack::Debugger::Panel objects 
);

sub new {
    my $class = shift;
    my %args  = @_;

    die "You must specify a data directory for collecting debugging data"
        unless exists $args{'data_dir'};

    die "You must specify a valid & writable data directory"
        unless -d $args{'data_dir'} && -w $args{'data_dir'};

    if (exists $args{'panels'}) {
        foreach my $panel (@{$args{'panels'}}) {
            die "Panel object must be a subclass of Plack::Debugger::Panel"
                unless $panel->isa('Plack::Debugger::Panel');
        }
    }

    bless {
        data_dir => $args{'data_dir'},
        panels   => $args{'panels'} || []
    } => $class;
}

sub application { Plack::App::Debugger->new( debugger => @_ )         }
sub collector   { Plack::Middleware::Collector->new( debugger => @_ ) }
sub injector    { Plack::Middleware::Injector->new( debugger => @_ )  }

1;

__END__