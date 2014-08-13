package Plack::Debugger;

use strict;
use warnings;

use File::Spec;
use POSIX qw[ strftime ];

use Plack::App::Debugger;

# consider Plack::Util::load_class ...
use Plack::Middleware::Debugger::Collector;
use Plack::Middleware::Debugger::Injector;

use Plack::Debugger::Panel;

use Plack::Util::Accessor (
    'data_dir',     # directory where collected debugging data is stored
    'serializer',   # CODE ref serializer for data into data-dir
    'filename_gen', # CODE ref for generating filenames for data-dir
    'panels',       # array ref of Plack::Debugger::Panel objects 
);

sub new {
    my $class = shift;
    my %args  = @_;

    die "You must specify a data directory for collecting debugging data"
        unless exists $args{'data_dir'};

    die "You must specify a valid & writable data directory"
        unless -d $args{'data_dir'} && -w $args{'data_dir'};

    die "You must provide a serializer for writing data"
        unless exists $args{'serializer'};

    if (exists $args{'panels'}) {
        die "You must provide panels as an ARRAY ref"
            unless ref $args{'panels'} eq 'ARRAY';

        foreach my $panel ( @{$args{'panels'}} ) {
            die "Panel object must be a subclass of Plack::Debugger::Panel"
                unless $panel->isa('Plack::Debugger::Panel');
        }
    }

    unless (exists $args{'filename_gen'}) {
        my $FILENAME_ID = 0;
        $args{'filename_gen'} = sub { sprintf "%s-%s", strftime("%F_%T", localtime), ++$FILENAME_ID };
    }

    bless {
        data_dir     => $args{'data_dir'},
        serializer   => $args{'serializer'},
        filename_gen => $args{'filename_gen'},
        panels       => $args{'panels'} || []
    } => $class;
}

sub application { Plack::App::Debugger->new( debugger => @_ )         }
sub collector   { Plack::Middleware::Collector->new( debugger => @_ ) }
sub injector    { Plack::Middleware::Injector->new( debugger => @_ )  }

sub run_before_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $panel->before->( $panel, $env ) if $panel->has_before;
    }
}

sub run_after_phase {
    my ($self, $env, $resp) = @_;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $panel->after->( $panel, $env, $resp ) if $panel->has_after;
    }
}

sub store_results {
    my $self = shift;

    my %results;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $results{ $panel->title }  = $panel->get_result;
    }
    
    my $file = File::Spec->catfile( $self->{'data_dir'}, $self->{'filename_gen'}->() );
    my $fh   = IO::File->new( $file, '>' ) or die "Could not open file($file) because: $!";
    $fh->print( $self->{'serializer'}->( \%results ) );
    $fh->close;
}

1;

__END__